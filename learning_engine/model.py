"""Chronological, shrinkage-regularized Poisson model (no betting claims)."""
from __future__ import annotations
from collections import Counter
from datetime import timedelta
from math import exp, isfinite, log
from .sources import Match

PARAMETERS = ((6.0, 180.0), (12.0, 300.0), (20.0, 400.0))
LAG_DAYS = 3


def clip(v: float, low: float, high: float) -> float:
    return max(low, min(high, v))


def score_probabilities(home_lambda: float, away_lambda: float) -> dict[str, float]:
    if not (0 < home_lambda <= 4 and 0 < away_lambda <= 4):
        raise ValueError('Expected positive plausible goal rates')
    hs = [exp(-home_lambda)]
    aw = [exp(-away_lambda)]
    for n in range(1, 13):
        hs.append(hs[-1] * home_lambda / n)
        aw.append(aw[-1] * away_lambda / n)
    p = [0., 0., 0.]
    total = 0.
    for i, hi in enumerate(hs):
        for j, aj in enumerate(aw):
            pr = hi * aj
            total += pr
            p[0 if i > j else 1 if i == j else 2] += pr
    p = [v / total for v in p]
    goals = home_lambda + away_lambda
    return {'home': p[0], 'draw': p[1], 'away': p[2],
            'over25': 1-exp(-goals)*(1+goals+goals**2/2),
            'btts': (1-exp(-home_lambda))*(1-exp(-away_lambda))}


def eligible_history(fixtures: list[Match], target: Match) -> list[Match]:
    limit = target.day - timedelta(days=LAG_DAYS)
    return [x for x in fixtures if x.league == target.league and x.finished and x.day < limit
            and x.home_goals <= 12 and x.away_goals <= 12]


def predict(history: list[Match], target: Match, prior: float = 6.0, decay_days: float = 180.0) -> dict | None:
    past = eligible_history(history, target)
    if len(past) < 80:
        return None
    home = [m for m in past if m.home == target.home]
    away = [m for m in past if m.away == target.away]
    if min(len(home), len(away)) < 5:
        return None
    cutoff = target.day - timedelta(days=LAG_DAYS)
    def weight(m: Match) -> float:
        return exp(-(cutoff - m.day).days / decay_days)
    wtotal = sum(weight(m) for m in past)
    league_home = clip(sum(weight(m)*m.home_goals for m in past)/wtotal, .5, 2.7)
    league_away = clip(sum(weight(m)*m.away_goals for m in past)/wtotal, .5, 2.7)
    def team_rate(rows, scored, conceded, general_scored, general_conceded):
        mass = sum(weight(m) for m in rows)
        g = (sum(weight(m)*getattr(m, scored) for m in rows) + prior*general_scored)/(mass+prior)
        c = (sum(weight(m)*getattr(m, conceded) for m in rows) + prior*general_conceded)/(mass+prior)
        return g, c
    h_sc, h_con = team_rate(home, 'home_goals', 'away_goals', league_home, league_away)
    a_sc, a_con = team_rate(away, 'away_goals', 'home_goals', league_away, league_home)
    h_goal = clip(h_sc*a_con/league_home, .35, 3.5)
    a_goal = clip(a_sc*h_con/league_away, .35, 3.5)
    p = score_probabilities(h_goal, a_goal)
    if any(not isfinite(z) or z < 0 or z > 1 for z in p.values()) or abs(sum(p[z] for z in ('home','draw','away'))-1)>1e-9:
        raise ArithmeticError('Invalid prediction probabilities')
    return {'p': p, 'xg': {'home': h_goal, 'away': a_goal},
            'history': {'league': len(past), 'home_at_home': len(home), 'away_away': len(away)}}


def baseline(history: list[Match], target: Match) -> dict | None:
    games = eligible_history(history, target)
    if len(games) < 80:
        return None
    count = Counter('home' if m.home_goals > m.away_goals else 'draw' if m.home_goals == m.away_goals else 'away' for m in games)
    return {k:(count[k]+2)/(len(games)+6) for k in ('home','draw','away')}


def metrics(cases: list[tuple[dict, Match]]) -> dict:
    n = len(cases)
    if not n:
        return {'n': 0, 'accuracy': None, 'brier': None, 'log_loss': None}
    right = 0
    brier = loss = 0.
    for p, target in cases:
        outcome = 'home' if target.home_goals > target.away_goals else 'draw' if target.home_goals == target.away_goals else 'away'
        keys = ('home','draw','away')
        right += max(keys, key=lambda x:p[x]) == outcome
        brier += sum((p[k] - (1 if k==outcome else 0))**2 for k in keys)
        loss += -log(max(1e-9, p[outcome]))
    return {'n': n, 'accuracy': round(right/n, 4), 'brier': round(brier/n, 4), 'log_loss': round(loss/n, 4)}


def evaluate(fixtures: list[Match], season: str, prior: float, decay: float) -> tuple[dict,dict]:
    all_matches = sorted(fixtures,key=lambda m:(m.day,m.league,m.home,m.away))
    forecast, comparator = [], []
    for match in all_matches:
        if match.season != season or not match.finished:
            continue
        prediction = predict(all_matches, match, prior=prior, decay_days=decay)
        base = baseline(all_matches, match)
        if prediction is not None and base is not None:
            forecast.append((prediction['p'], match))
            comparator.append((base, match))
    return metrics(forecast), metrics(comparator)
