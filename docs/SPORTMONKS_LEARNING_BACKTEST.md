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
