# Tiki-Data learning engine v3 — operational contract

## Data provenance and security
- Retain the current Cloudflare secret `SPORTMONKS_API_TOKEN`; no credentials in Git, browser URLs or logs.
- Raw Sportmonks provider responses are NEVER stored; only verified finished domestic league scores, team labels, Sportmonks fixture ID and observation time in `sportmonks_training_results`.
- Sportmonks terms allow storing the delivered data *inside the subscriber's own app*; raw resale/redistribution is not allowed. Team/logo rights are separate from match scores.
- Model data is stored separately by provider; at training time match IDs are de-duplicated by normalized league, day and home/away identities. The original CC0 score table is never overwritten.
- The 90-minute Poisson model excludes matches not confirmed full-time and excludes extra time / penalty states. Missing or inconsistent scores are discarded.

## Incremental training data ingestion
- On a home/predictions page view, `smFocusResponse` dispatches `tdMaybeSyncHistory` in `ctx.waitUntil`.
- A D1 compare-and-swap lease prevents duplicate concurrent syncs. A successful sync pauses further fetching for 20 hours; errors retry after one hour.
- Fetch 3 sequential backlog days (starting 2026-09-21) plus the two most recently completed UTC dates. A completed run advances the stored cursor.
- Fetch only verified subscribed leagues, normalize and upsert final scores, invalidate the trained model cache if results were observed.
- A new `fhLoadModel` snapshot trains from both OpenFootball CC0 and these permitted finished Sportmonks scores every 6 hours (or sooner after sync), with a 3-day embargo.
- The prediction model remains **experimental**; historic backtesting does not imply verified future performance.
- Inspect `GET /api/model/sync-status` to see last attempt, import count and cursor.

## Walk-forward backtesting (read-only)
- `GET /api/model/backtest` runs a fixed expanding-window monthly simulation starting 2025-08-01 using the existing OpenFootball CC0 results. It caches the summary for 24 hours.
- Every simulated test month is excluded from training (a further 3-day embargo protects the boundary). The model is retrained at each fold boundary.
- Report true 1X2 accuracy, Brier score, multiclass log loss, Over 2.5 Brier, GG/BTTS Brier, ten-bin expected calibration error, league-specific coverage, and comparison to a per-league Poisson historical baseline.
- Abstain from scoring a match if there are fewer than three verified home and three away observations for its teams. No fabricated predictions, historical bookmaker prices or premium odds feed in model training.
- Historical scores already in OpenFootball are used exclusively in backtest folds. Newly imported Sportmonks scores train live model parameters, but are **not** retrospectively inserted into older fold simulations. This avoids silently changing past benchmarks and permits defensible re-evaluation separately.
- Daily source sync is visitor-triggered; this is *not* a guaranteed overnight cron. A dedicated Cloudflare Worker cron is a possible future hardening task.

## Deploy / migrations
Table `sportmonks_training_results` must exist before activating import:
```sql
CREATE TABLE IF NOT EXISTS sportmonks_training_results (
 fixture_id INTEGER PRIMARY KEY,
 dataset_slug TEXT NOT NULL,
 league_key TEXT NOT NULL,
 match_date TEXT NOT NULL,
 home_team TEXT NOT NULL,
 away_team TEXT NOT NULL,
 home_score INTEGER NOT NULL CHECK(home_score BETWEEN 0 AND 15),
 away_score INTEGER NOT NULL CHECK(away_score BETWEEN 0 AND 15),
 observed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sportmonks_train_date ON sportmonks_training_results(match_date);
```
Source sync status uses two keys in the existing D1 cache table, avoiding a more invasive migration. No old tables are deleted.

## Hierarchical prediction coverage v5

**Why historical data did not appear for many fixtures:** Different names in Sportmonks and OpenFootball (e.g. `Lazio` / `SS Lazio`, `Rennes` / `Stade Rennais 1901`) prevented reliable home/away sample lookup. A verified dictionary now maps official observed variants to one canonical identity. Do not equate clubs with similar names without verification.

Public pre-match forecast evidence tiers:
1. `team`: at least three verified, matching home and away samples for both clubs; model remains experimental.
2. `partial_team`: only one club has at least three matching venue samples; the other uses a league-wide venue baseline.
3. `league`: no full team matchup data; probabilities are computed solely from fitted home/away scoring averages in that league, labeled low-confidence.
4. `cross_league`: no qualifying scores in the fixture league; averages are computed from **actual** licensed finished scores in other leagues. Very low confidence; **NOT** a league-specific or team-specific strength claim. This currently applies to Cyprus until enough finished domestic games accumulate in the database.

No arbitrary 43/26/31 values or hardcoded goal rates are published. If the database or source is missing, percentages must remain unavailable rather than made up. The public API exposes `prediction_tier`, `confidence`, `evidence_source`, `model_note`, historical sample sizes, and tier counts in coverage. Live match scenarios remain conditional on verified team evidence, minute and score; the lower-confidence pre-match baseline is **not** reused as a live forecast.

The separate `/api/model/backtest` endpoint has been versioned to `walk_forward_hierarchical_v5_1` to avoid applying the former v3 performance claim to v5. Its time-split retrospective results must be considered separately from verified prospective performance. The prospective forecast audit remains restricted to the `team` evidence tier, ensuring historical continuity of high-evidence records.

The model snapshot key is `tiki-hierarchical-poisson-coverage-v5`; existing snapshots and CC0 data are retained. The rolling 6-hour training and 3-day embargo remain in place.
