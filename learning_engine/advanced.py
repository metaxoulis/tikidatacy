"""Research-only Dixon–Coles refinement of the chronological Poisson baseline.

No production promotion. Fits a low-score interaction by damped Newton steps with
a curvature penalty, using only matches available before the prediction cutoff.
"""
from __future__ import annotations

from datetime import timedelta
from math import exp, isfinite, log
from .sources import Match
from .model import eligible_history, predict, metrics, clip

MAX_GOALS = 12
NEWTON_STEPS = 12
RHO_RIDGE = 30.0


def _poisson(rate: float, cap: int = MAX_GOALS) -> list[float]:
    out = [exp(-rate)]
    for k in range(1, cap + 1):
        out.append(out[-1] * rate / k)
    return out


def _tau(i: int, j: int, h: float, a: float, rho: float) -> float:
    if i == 0 and j == 0:
        return 1.0 - h * a * rho
    if i == 0 and j == 1:
        return 1.0 + h * rho
    if i == 1 and j == 0:
        return 1.0 + a * rho
    if i == 1 and j == 1:
        return 1.0 - rho
    return 1.0


def score_probabilities_dc(home_lambda: float, away_lambda: float, rho: float) -> dict:
    """Normalized score-grid: all betting *probabilities* agree with one joint PMF."""
    if not (0 < home_lambda <= 4 and 0 < away_lambda <= 4 and -.20 <= rho <= .20):
        raise ValueError("Invalid expected goals or correlation")
    hs, aws = _poisson(home_lambda), _poisson(away_lambda)
    entries = []
    for i, hp in enumerate(hs):
        for j, ap in enumerate(aws):
            tau = _tau(i, j, home_lambda, away_lambda, rho)
            if tau <= 0:
                raise ValueError("Nonpositive Dixon-Coles correction")
            entries.append((i, j, hp * ap * tau))
    mass = sum(p for _, _, p in entries)
    if not mass > 0:
        raise ArithmeticError("Zero score-grid mass")
    entries = [(i, j, p / mass) for i, j, p in entries]
    home = sum(p for i, j, p in entries if i > j)
    draw = sum(p for i, j, p in entries if i == j)
    away = sum(p for i, j, p in entries if i < j)
    over25 = sum(p for i, j, p in entries if i + j >= 3)
    btts = sum(p for i, j, p in entries if i > 0 and j > 0)
    top = sorted(entries, key=lambda x: x[2], reverse=True)[:5]
    probs = {'home': home, 'draw': draw, 'away': away,
             'over25': over25, 'under25': 1-over25,
             'btts': btts, 'no_btts': 1-btts,
             'home_clean_sheet': sum(p for _, j, p in entries if j == 0),
             'away_clean_sheet': sum(p for i, _, p in entries if i == 0)}
    if any(not isfinite(x) or x < -1e-12 or x > 1+1e-12 for x in probs.values()):
        raise ArithmeticError("Invalid probabilities")
    if abs(sum(probs[k] for k in ('home', 'draw', 'away')) - 1) > 1e-12:
        raise ArithmeticError("1X2 do not sum to one")
    return {'p': probs, 'scorelines': [{'score':f'{i}-{j}','probability':p}
                                       for i,j,p in top],
            'expected_total_goals': home_lambda + away_lambda,
            'tail_probability_bound': 1-sum(hs)*sum(aws)}


def fit_rho(history: list[Match], target: Match, decay_days: float = 180.0,
            ridge: float = RHO_RIDGE) -> dict:
    """Fit low-score interaction with penalized Newton-Raphson, without leakage.

    Uses league-average rates (not per-match fitted rates), so rho is a small
    league-level correction, not a free parameter per game/team.
    """
    past = eligible_history(history, target)
    if len(past) < 80 or ridge <= 0 or decay_days <= 0:
        return {'rho': 0.0, 'observations': len(past), 'status': 'insufficient_data'}
    end = target.day-timedelta(days=3)
    rows = [(m, exp(-(end-m.day).days/decay_days)) for m in past]
    mass = sum(w for _, w in rows)
    home_rate = clip(sum(w*m.home_goals for m,w in rows)/mass, .5, 2.7)
    away_rate = clip(sum(w*m.away_goals for m,w in rows)/mass, .5, 2.7)
    factors = []
    for m, w in rows:
        if m.home_goals > 1 or m.away_goals > 1:
            continue
        if m.home_goals == 0 and m.away_goals == 0:
            c = -home_rate*away_rate
        elif m.home_goals == 0 and m.away_goals == 1:
            c = home_rate
        elif m.home_goals == 1 and m.away_goals == 0:
            c = away_rate
        else:
            c = -1.
        factors.append((c, w))
    # Positivity of every low-score correction at all feasible league rates.
    limit_pos = min(.18, .95/(home_rate*away_rate))
    limit_neg = -min(.18, .95/max(home_rate,away_rate))
    rho = 0.
    for _ in range(NEWTON_STEPS):
        gradient = -ridge*rho
        hessian = -ridge
        for c,w in factors:
            denominator = 1+c*rho
            gradient += w*c/denominator
            hessian -= w*c*c/(denominator*denominator)
        new = clip(rho-gradient/hessian, limit_neg, limit_pos)
        if abs(new-rho) < 1e-9:
            rho = new
            break
        rho = new
    return {'rho': rho, 'observations': len(past),
            'weighted_low_scores': round(sum(w for _,w in factors),4),
            'status':'estimated'}


def predict_dc(history: list[Match], target: Match, prior: float = 6.0,
               decay_days: float = 180.0, rho_ridge: float = RHO_RIDGE) -> dict | None:
    """Abstain when the underlying venue-strength model cannot be estimated."""
    independent = predict(history,target,prior=prior,decay_days=decay_days)
    if independent is None:
        return None
    fit = fit_rho(history,target,decay_days=decay_days,ridge=rho_ridge)
    h,a = independent['xg']['home'],independent['xg']['away']
    # Avoid invalid score corrections on unusually large projected xG.
    lower = -min(.18, .95/max(h,a))
    upper = min(.18, .95/(h*a))
    rho = clip(fit['rho'],lower,upper)
    scores = score_probabilities_dc(h,a,rho)
    return {'p':scores['p'],'xg':independent['xg'],
            'history':independent['history'], 'scorelines':scores['scorelines'],
            'expected_total_goals':scores['expected_total_goals'],
            'rho':round(rho,6),'rho_status':fit['status'],
            'family':'time-decayed-shrinkage-poisson-dixon-coles'}


def evaluate_dc(fixtures: list[Match], season: str, prior: float, decay_days: float,
                rho_ridge: float = RHO_RIDGE) -> dict:
    """Same eligible predictions for new model and baseline, no selection bias."""
    chronological = sorted(fixtures,key=lambda m:(m.day,m.league,m.home,m.away))
    old, new = [], []
    for target in chronological:
        if target.season != season or not target.finished:
            continue
        old_prediction = predict(chronological,target,prior,decay_days)
        if old_prediction is None:
            continue
        candidate = predict_dc(chronological,target,prior,decay_days,rho_ridge)
        if candidate is None:
            continue
        old.append((old_prediction['p'],target))
        new.append((candidate['p'],target))
    return {'candidate':metrics(new),'independent':metrics(old),
            'brier_gain':round(metrics(old)['brier']-metrics(new)['brier'],5) if new else None,
            'logloss_gain':round(metrics(old)['log_loss']-metrics(new)['log_loss'],5) if new else None}
