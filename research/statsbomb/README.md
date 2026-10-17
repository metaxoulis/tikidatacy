# StatsBomb Open Data — isolated non-commercial research prototype

Official source: https://github.com/hudl/open-data
Official license: https://github.com/hudl/open-data/blob/master/LICENSE.pdf

## Intended use
This is a small local ingestion and chronological holdout experiment, **not** an automated training pipeline connected to Tiki-Data production. It never calls SportAPI.ai, AllSportsAPI, Cloudflare or D1 and does not alter the existing Poisson model. It never downloads or republishes the upstream dataset.

This repo provides selected JSON files with competition/season metadata, match lists, shot events and lineups. It is **not** a live service. For exploratory research only, and subject to the official StatsBomb terms. The StatsBomb Public Data User Agreement restricts commercial exploitation and redistribution. Before deriving a publicly served predictor or commercial application from the data, obtain appropriate permissions. For any permitted publications, credit **StatsBomb** and meet the logo attribution terms.

## Example local workflow
1. Manually obtain a permitted StatsBomb snapshot from the official repository.
2. Use a local research SQLite output file distinct from any production D1 path.
3. Run:

```bash
python3 research/statsbomb/study.py --matches /path/to/data/matches/9/281.json --events-dir /path/to/data/events --out /tmp/tiki-statsbomb-research.sqlite --holdout-from 2024-01-01
python3 -m unittest discover -s research/statsbomb -p 'test_*.py'
```

`research_matches` stores dates, teams and results; `research_shots` stores selected shot xG metadata. Do not publish raw ingested matches/shot rows to the website. Missing event files are accounted as zero **loaded shots**, not proof of zero shots in that match; use completeness checks before model fitting.

The evaluation cut-off date must be earlier than the prediction being evaluated. Use train-only parameters, preserve competition/season/provider IDs, prevent leakage from future events, and report sample coverage, Brier score and calibration before claiming any accuracy gain.

**No direct connection to Tiki-Data's production Learning Engine is included.** Additional licensing/quality gates are required.
