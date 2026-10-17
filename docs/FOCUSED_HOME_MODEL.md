# Tiki-Data focused homepage — experimental score-based training

## Source separation
- OpenFootball **CC0-1.0**: 5,674 matches already in Cloudflare D1 `openfootball_matches` at discovery, 4,031 finished scores. This is the only source whose full historical scores are fitted and persisted as `focus_model_snapshots` (model coefficients derived from these licensed results). CC0 source: https://github.com/openfootball/football.json
- SportAPI.ai and AllSportsAPI: server-side API credentials. Fetch transient upcoming fixture information; only minimal selected public display fields and bounded ten-minute homepage snapshots are cached. **Do not bulk persist all provider responses** until storage, reuse and logo permissions are confirmed; see https://allsportsapi.com/terms-of-use.
- StatsBomb Open Data: **research-only** due to special conditions, never mixed into production training or copied into commercial D1.

## Trained model is not an LLM
For each league among `epl`, `laliga`, `bundesliga`, `seriea`, `ligue1`, `greece` we fit exponentially time-decayed venue-based rates to eligible finished CC0 results at least three calendar days before the training date. With empirical-Bayes three-match priors, home scoring rate and away scoring rate are formed from corresponding team venue attack and opponent venue defense factors. A normalized independent-Poisson grid supplies 1X2 / BTTS / O-U 2.5 and most likely result. This is a **statistical model, not a fine-tuned large language model**.

No reliable Cyprus finished-score history currently exists in approved D1 source coverage. Cyprus can display real fixtures from either API, but the model must label its generic prior as **very low confidence** and not pretend to use Cyprus team history. Unmatched team aliases likewise receive a labelled generic baseline.

## Display and integrity rules
Only seven competition categories (top five England, Spain, Germany, Italy, France, Greece and Cyprus). Match country is checked to avoid foreign same-name competitions. No fake teams, no finished fixtures, no empty league cards. Selection window: next three UTC dates, from the actual providers. Show at most seven matches on homepage; others remain in Predictions and Match Centre.

Experimental model is **not** validated for real betting; previous independently trained QA candidate is BLOCKED because current-season score sources are stale and there are not enough prospective predictions. Display `validated: false` and model evidence honestly. Historical-sample gains in retrospective backtests do not prove forward accuracy.

## Storage and prospective evaluations
Migration `docs/focus-home.sql` creates table `focus_model_snapshots` for derived parameters. Refit after six hours on first request (trained parameters are never automatically promoted to a validated model). Focused selected cards are cached ten minutes using `sportapi_home_cache`. For model cards with matched historical team data and >2 hours until kickoff, log an independent *pre-match* observation in existing `prospective_forecast_log`. No retrospective forecasts are labelled as prospective. Outcomes should be verified later from licensed completed scores before Brier and calibration assessment.

Because the current D1 result feed misses recent scores, further datasource quality work is required before accuracy or training readiness claims.

## Training refresh — 17 October 2026

A new independently evaluated **v2 statistical candidate** was selected using chronological historical results from the D1 OpenFootball CC0 source. The selection grid covered prior pseudo-matches `3/6/10` and temporal decay constants `120/210/360 days`. Every training prediction used only historical scores at least **three days older than kickoff**; evaluation computed coherent 1X2 Poisson scores. No match from the 2026–27 holdout influenced the hyperparameter selection.

| Cohort | Matches | Brier 1X2 (sum of 3 squared errors) | Log loss | Highest-probability accuracy |
| --- | ---: | ---: | ---: | ---: |
| 2025–26 validation: chosen prior 3 / decay 360 | 1,723 | 0.62197 | 1.03858 | Not reported |
| 2026–27 holdout: v2 | 197 | 0.61210 | 1.02156 | 49.75% |
| 2026–27 same holdout: previous prior 6 / decay 210 | 197 | 0.63480 | 1.05266 | 46.70% |
| 2026–27 same holdout: weighted league-average baseline | 197 | 0.69416 | 1.14115 | 43.15% |

**Not verified live accuracy:** these are retrospective walk-forward checks on currently available archives, not immutable pre-match snapshots. Only historical score archives as currently stored were tested; potential archive revisions cannot be excluded. The stored historical data for the top five leagues ends on **2026-09-20**, Greece on **2025-11-03**, and there is no usable Cyprus finished-score dataset in this source. No source score is invented; any unmatched team/league is still excluded from published predictions. The advanced independent Dixon–Coles Learning Engine remains BLOCKED for automatic promotion, and v2 independent Poisson still has `validated:false`.

The new snapshot key is `tiki-home-venue-poisson-research-v2`; home cache version `focus_v3` forces recalculation without reusing old v1 weights or predictions. It is still trained lazily when the homepage/predictions requests refresh the model; data freshness and prospective calibration require ongoing work.
