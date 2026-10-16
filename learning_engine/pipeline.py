"""Scheduled offline retraining. NO automatic Cloudflare or production promotion."""
from __future__ import annotations
import argparse
import json
from collections import defaultdict
from datetime import date, datetime, timezone, timedelta
from pathlib import Path
from .sources import DATASETS, Match, dataset_integrity, download_dataset
from .model import PARAMETERS, LAG_DAYS, evaluate, clip
from .advanced import evaluate_dc, RHO_RIDGE
from math import exp

VERSION = 'learning-engine-v1.0.0'
CURRENT_SEASON = '2026-27'


def quality_gates(games: list[Match], now: date) -> dict:
    breakdown = []
    reasons = []
    for league in sorted({m.league for m in games if m.season == CURRENT_SEASON}):
        recent = [m for m in games if m.league==league and m.season==CURRENT_SEASON
                  and now-timedelta(days=21) <= m.day <= now-timedelta(days=3)]
        scored = sum(m.finished for m in recent)
        coverage = scored / len(recent) if recent else 0
        future_scored = sum(m.finished and m.day > now for m in games if m.league==league and m.season==CURRENT_SEASON)
        okay = bool(recent) and len(recent)>=5 and coverage>=.85 and future_scored==0
        breakdown.append({'league':league,'recent_fixtures':len(recent),'scored_recent':scored,
                          'recent_completeness':round(coverage,4),'future_scores':future_scored,
                          'quality_pass':okay})
        if not okay:
            reasons.append(f'{league}: inadequate recently recorded finals ({scored}/{len(recent)}), future scores={future_scored}')
    if not breakdown:
        reasons.append('No current-season competitions in sources')
    latest = max((m.day for m in games if m.finished and m.day <= now),default=None)
    # A stale historical archive must never be presented as an up-to-date live model.
    if latest is None or (now-latest).days > 7:
        reasons.append(f'Stale final-score feed: latest={latest}; max age=7 days')

    return {'passed':not reasons,'reasons':reasons,'by_league':breakdown,
            'window':'21 days to 3 days before run date','minimum_recent_coverage':.85}


def fit_profiles(games: list[Match], *, asof: date, prior: float, decay: float) -> dict:
    limit = asof-timedelta(days=LAG_DAYS)
    by_league: dict[str,list[Match]] = defaultdict(list)
    for m in games:
        if m.finished and m.day < limit and m.home_goals <= 12 and m.away_goals <= 12:
            by_league[m.league].append(m)
    output = {}
    for league, matches in sorted(by_league.items()):
        if len(matches)<80:
            continue
        w = lambda m:exp(-(limit-m.day).days / decay)
        total=sum(w(m) for m in matches)
        mean_h=clip(sum(w(m)*m.home_goals for m in matches)/total,.5,2.7)
        mean_a=clip(sum(w(m)*m.away_goals for m in matches)/total,.5,2.7)
        teams = sorted(set(m.home for m in matches) | set(m.away for m in matches))
        prof = {}
        for team in teams:
            home=[m for m in matches if m.home==team]
            away=[m for m in matches if m.away==team]
            def estimate(rows, gf, ga, league_for,league_against):
                mass=sum(w(m) for m in rows)
                return {'goals_for':round((sum(w(m)*getattr(m,gf) for m in rows)+prior*league_for)/(mass+prior),5),
                        'goals_against':round((sum(w(m)*getattr(m,ga) for m in rows)+prior*league_against)/(mass+prior),5),
                        'samples':len(rows)}
            prof[team]={'home':estimate(home,'home_goals','away_goals',mean_h,mean_a),
                        'away':estimate(away,'away_goals','home_goals',mean_a,mean_h)}
        output[league]={'league_home_mean':round(mean_h,5),'league_away_mean':round(mean_a,5),
                        'historical_results':len(matches),'teams':prof}
    return output


def train(fixtures:list[Match], *,asof: date, manifest:list[dict],prospective_verified:int=0) -> dict:
    dataset_integrity(fixtures)
    quality=quality_gates(fixtures,asof)
    finished_known=[m for m in fixtures if m.day <= asof-timedelta(days=3)]
    validation=[]
    for prior,decay in PARAMETERS:
        v,base=evaluate(finished_known,'2025-26',prior,decay)
        validation.append({'prior':prior,'decay_days':decay,'model':v,'baseline':base})
    qualified=[v for v in validation if v['model']['n']>=250]
    selected=min(qualified,key=lambda x:(x['model']['brier'],x['model']['log_loss'])) if qualified else None
    holdout=None
    advanced_validation=None
    advanced_holdout=None
    if selected:
        trial,base=evaluate(finished_known,CURRENT_SEASON,selected['prior'],selected['decay_days'])
        holdout={'model':trial,'baseline':base}
        advanced_validation=evaluate_dc(finished_known,'2025-26',selected['prior'],selected['decay_days'],RHO_RIDGE)
        advanced_holdout=evaluate_dc(finished_known,CURRENT_SEASON,selected['prior'],selected['decay_days'],RHO_RIDGE)
    blockers=list(quality['reasons'])
    if not selected:
        blockers.append('Validation coverage insufficient to select hyperparameters')
    else:
        if selected['model']['brier']>selected['baseline']['brier']-.002 or selected['model']['log_loss']>selected['baseline']['log_loss']-.002:
            blockers.append('Candidate did not outperform baseline on validation')
        if (not holdout or holdout['model']['n']<80 or
              holdout['model']['brier']>holdout['baseline']['brier']-.002 or
              holdout['model']['log_loss']>holdout['baseline']['log_loss']-.002):
            blockers.append('Holdout is too small or did not outperform baseline')
    if selected:
        # Improvement must be demonstrated on a temporally later, untouched season.
        # Never select the candidate because it won on its own validation set alone.
        for label,report,minimum in [('validation',advanced_validation,250),('holdout',advanced_holdout,80)]:
            if (not report or report['candidate']['n'] < minimum or
                    report['brier_gain'] is None or report['logloss_gain'] is None or
                    report['brier_gain'] < .002 or report['logloss_gain'] < .002):
                blockers.append(f'Dixon-Coles candidate not proven better on {label} by Brier and log loss')
    if prospective_verified<100:
        blockers.append(f'Only {prospective_verified} independently logged pre-match predictions; 100 required before promotion review')
    profile=fit_profiles(finished_known,asof=asof,
                         prior=selected['prior'] if selected else 6,
                         decay=selected['decay_days'] if selected else 180)
    return {'engine_version':VERSION,'run_date_utc':asof.isoformat(),
            'run_at_utc':datetime.now(timezone.utc).isoformat(timespec='seconds'),
            'licensing':'OpenFootball football.json: CC0 1.0 Universal',
            'data_source':'OpenFootball archive downloaded at run time; not a live/as-of historical record',
            'model_family':'Research candidate: Poisson with time-decay, empirical-Bayes venue shrinkage and penalized Dixon-Coles correction',
            'numerical_method':'bounded Newton-Raphson optimization of penalized low-score log likelihood',
            'rho_ridge':RHO_RIDGE,
            'advanced_validation_2025_26':advanced_validation,
            'advanced_holdout_2026_27':advanced_holdout,
            'feature_cutoff_policy':f'Exclude results within {LAG_DAYS} calendar days of fixture date',
            'source_manifest':manifest,'datasets':len(manifest),'fixtures':len(fixtures),
            'validation_2025_26':validation,'holdout_2026_27':holdout,
            'selection':{'prior':selected['prior'],'decay_days':selected['decay_days']} if selected else None,
            'data_quality':quality,
            'prospective_verified_predictions':prospective_verified,
            'candidate_status':'READY_FOR_HUMAN_REVIEW' if not blockers else 'BLOCKED',
            'blockers':blockers,
            'important_caveats':[
                'Current public Tiki-Data site uses a different prediction provider; do not claim these metrics for it.',
                'Dixon-Coles candidate is NOT deployed or used for live percentages until quality gates and prospective validation pass.',
                'Historical backtesting uses archives fetched now, not immutable snapshots taken before every historical fixture.',
                'An automated retrain is not automatic model promotion; source gaps and missing lineups remain.',
                'Accuracy and probability calibration are uncertain; predictions are not bookmaker odds or guaranteed outcomes.'
            ],
            'candidate_team_profiles':profile}


def write_reports(result:dict,output:Path) -> None:
    output.mkdir(parents=True,exist_ok=True)
    candidate={k:result[k] for k in ('engine_version','run_date_utc','model_family','feature_cutoff_policy','selection','candidate_status','blockers','candidate_team_profiles')}
    report={k:v for k,v in result.items() if k!='candidate_team_profiles'}
    (output/'candidate_model.json').write_text(json.dumps(candidate,ensure_ascii=False,indent=2,sort_keys=True)+'\n',encoding='utf-8')
    (output/'evaluation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2,sort_keys=True)+'\n',encoding='utf-8')
    lines=[f"# Tiki-Data Learning Engine — {result['run_date_utc']}",
            f"**Status: {result['candidate_status']}**",'',
            f"Datasets: {result['datasets']}; fixtures: {result['fixtures']}",
            '',"## Quality and release checks"]
    lines += ['- '+b for b in result['blockers']] or ['- All automated gates passed. Human review is still mandatory.']
    lines += ['', '## Validation (2025/26, retrospective; archived data may have been revised)']
    for v in result['validation_2025_26']:
        lines.append(f"- prior {v['prior']}, decay {v['decay_days']}d: model Brier={v['model']['brier']}, 1X2 top pick={v['model']['accuracy']}, N={v['model']['n']}; baseline Brier={v['baseline']['brier']}")
    if result.get('advanced_validation_2025_26'):
        a=result['advanced_validation_2025_26']
        lines+=['',f"## Dixon-Coles vs independent Poisson — validation 2025/26: N={a['candidate']['n']}, DC Brier={a['candidate']['brier']}, independent={a['independent']['brier']}, Δ={a['brier_gain']}"]
    if result.get('advanced_holdout_2026_27'):
        a=result['advanced_holdout_2026_27']
        lines+=['',f"## Dixon-Coles vs independent Poisson — holdout 2026/27: N={a['candidate']['n']}, DC Brier={a['candidate']['brier']}, independent={a['independent']['brier']}, Δ={a['brier_gain']}"]
    if result['holdout_2026_27']:
        h=result['holdout_2026_27']
        lines += ['',f"## Holdout 2026/27: N={h['model']['n']}, model Brier={h['model']['brier']}, baseline={h['baseline']['brier']}"]
    lines += ['', 'Do not promote automatically. No Cloudflare production credentials or deployments are used.']
    (output/'REPORT.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')


def main() -> int:
    parser=argparse.ArgumentParser(description='Tiki-Data offline learning engine: retrain candidate, report metrics, NEVER deploy.')
    parser.add_argument('--output',type=Path,default=Path('learning-engine-output'))
    parser.add_argument('--asof',type=date.fromisoformat,default=datetime.now(timezone.utc).date())
    a=parser.parse_args()
    games=[]; sources=[]
    for season,league in DATASETS:
        matches,info=download_dataset(season,league)
        games.extend(matches)
        sources.append(info)
        print(f"{season}/{league}: {len(matches)} games ({info['finished']} scored)")
    report=train(games,asof=a.asof,manifest=sources)
    write_reports(report,a.output)
    print(f"Candidate: {report['candidate_status']}; {len(report['blockers'])} release blockers")
    for reason in report['blockers']:
        print(' BLOCK:',reason)
    return 0


if __name__=='__main__':
    raise SystemExit(main())
