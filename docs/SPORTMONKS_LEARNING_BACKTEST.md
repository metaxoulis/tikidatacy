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

## Historical API ingestion v6

The historical importer uses the **Sportmonks v3 date-range endpoint**, a strict inclusive 28-day window, 50 records/page, a maximum of 20 pages per window, and the existing secret `SPORTMONKS_API_TOKEN`. This is deliberately *not* a dump of raw data to an LLM.

- D1 keys `sportmonks_backfill_cursor_v6` and `sportmonks_backfill_lock_v6` provide checkpointing and a global lease. Cursor begins `2024-07-01`, progressing 28 days at a time through the third UTC day before the current date. This bounded historical horizon may be extended if the subscription supports older seasons.
- `smLeagues` identifiers must be obtained from a previously verified Sportmonks feed or verified via the provider for the date window; request `fixtureLeagues` and also reclassify each returned fixture with its `league.country`.
- Only state `FT`/standard full-time, valid participants, valid goals and permitted leagues can enter `sportmonks_training_results`. Extra-time / penalty results are not ingested as a regular-time score. Raw JSON, odds, live event narratives and lineups are not stored in this table.
- Upsert by Sportmonks fixture ID (duplicate-safe); model's normalized league/date/teams match-key also deduplicates when OpenFootball and Sportmonks overlap.
- DB checkpoint advances only after all pages and D1 writes succeed. 429/403/errors do **not** advance cursor. Status and progress are shown by `GET /api/model/sync-status`.
- Each home-feed request opportunistically dispatches one batch; a successful batch has a short lease before the next batch. Visitor-triggered sync is **not a guaranteed scheduled full import** and cannot be described as fully synchronized until the reported checkpoint reaches current data.
- The numeric probabilities are from empirical goal history, not freeform LLM generation. In particular, outcomes, scores, post-match xG, events, premium odds, or other future-derived data must not leak into their own earlier pre-match predictions.
- Worker model version `tiki-historical-ingestion-poisson-v6` and evaluation cache `walk_forward_historical_v6_1` are isolated from previous backtests. Backtesting remains based on previously licensed historical results and 3-day embargo; introducing additional Sportmonks seasons should trigger a new, properly time-split evaluation rather than retroactively claiming higher accuracy.

## Scheduled historical sync

Cloudflare Worker `tiki-data-history-scheduler` is deployed independently of the Pages site, with a Cron Trigger `0 */4 * * *` (every four hours, UTC). Script source: `workers/history-scheduler.js`.

The schedule requests the normal read-only `/api/home-focus` feed. The Pages backend safely dispatches its guarded backfill in `ctx.waitUntil`, sharing D1 leases with visitor-triggered runs; the Cron Worker receives **no Sportmonks token or D1 secret**. A scheduled run is not evidence that all historical records are already imported; check `/api/model/sync-status` for the actual range and completed batches. The rollout was confirmed to have successfully imported an initial 103 finished records from 2024; older/latest data completeness remains subscription-dependent.

When backfill catches up, reduce Cron frequency if provider quota or cost warrants it. Cloudflare Pages code deployments remain manual and separate from the Cron Worker.
