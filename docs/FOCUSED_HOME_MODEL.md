# Tiki-Data focused homepage — experimental score-based training

## Source separation
- OpenFootball **CC0-1.0**: 5,674 matches already in Cloudflare D1 `openfootball_matches` at discovery, 4,031 finished scores. This is the only source whose full historical scores are fitted and persisted as `focus_model_snapshots` (model coefficients derived from these licensed results). CC0 source: https://github.com/openfootball/football.json
- SportAPI.ai and AllSportsAPI: server-side API credentials. Fetch transient upcoming fixture information; only minimal selected public display fields and bounded ten-minute homepage snapshots are cached. **Do not bulk persist all provider responses** until storage, reuse and logo permissions are confirmed; see https://allsportsapi.com/terms-of-use.
- StatsBomb Open Data: **research-only** due to special conditions, never mixed into production training or copied into commercial D1.

## Trained model is not an LLM
For each league among `epl`, `laliga`, `bundesliga`, `seriea`, `ligue1`, `greece` we fit exponentially time-decayed venue-based rates to eligible finished CC0 results at least three calendar days before the training date. With empirical-Bayes six-match priors, home scoring rate and away scoring rate are formed from corresponding team venue attack and opponent venue defense factors. A normalized independent-Poisson grid supplies 1X2 / BTTS / O-U 2.5 and most likely result. This is a **statistical model, not a fine-tuned large language model**.

No reliable Cyprus finished-score history currently exists in approved D1 source coverage. Cyprus can display real fixtures from either API, but the model must label its generic prior as **very low confidence** and not pretend to use Cyprus team history. Unmatched team aliases likewise receive a labelled generic baseline.

## Display and integrity rules
Only seven competition categories (top five England, Spain, Germany, Italy, France, Greece and Cyprus). Match country is checked to avoid foreign same-name competitions. No fake teams, no finished fixtures, no empty league cards. Selection window: next three UTC dates, from the actual providers. Show at most seven matches on homepage; others remain in Predictions and Match Centre.

Experimental model is **not** validated for real betting; previous independently trained QA candidate is BLOCKED because current-season score sources are stale and there are not enough prospective predictions. Display `validated: false` and model evidence honestly. Historical-sample gains in retrospective backtests do not prove forward accuracy.

## Storage and prospective evaluations
Migration `docs/focus-home.sql` creates table `focus_model_snapshots` for derived parameters. Refit after six hours on first request (trained parameters are never automatically promoted to a validated model). Focused selected cards are cached ten minutes using `sportapi_home_cache`. For model cards with matched historical team data and >2 hours until kickoff, log an independent *pre-match* observation in existing `prospective_forecast_log`. No retrospective forecasts are labelled as prospective. Outcomes should be verified later from licensed completed scores before Brier and calibration assessment.

Because the current D1 result feed misses recent scores, further datasource quality work is required before accuracy or training readiness claims.
