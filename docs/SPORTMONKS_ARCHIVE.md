# Sportmonks preservation export

This branch adds a private resumable export. It does not merge into main, train a new model, change published forecasts, or overwrite the original Sportmonks archive.

## Original archive

Cloudflare D1 `tiki_sportmonks_archive` (da4c6bd7-f434-4522-8bea-ef0c98a53287) was verified on 2026-10-29 to contain 47,918 fixtures dated 2000-07-11 through 2027-06-04, plus tables for teams, leagues, seasons, coaches, venues, events, lineups, statistics, xG and images. This establishes what is stored; it does not establish upstream completeness.

## Supplementary export

The requested datasets are versioned in `frontend/sportmonks-archive.mjs` (43 base tasks), with extra season-specific standings, schedules and topscorer jobs discovered during the seasons export. Fixture core data, detailed lineup statistics, and additional xG/pressure/news data are separate full passes so enrichment failures remain visible.

Complete JSON responses are saved as gzip BLOBs with SHA-256 of the decompressed UTF-8 JSON, request path/parameters, timestamps and record counts. Credential strings in pagination URLs are redacted. Pages are immutable and the cursor advances only after persistence. Counts across datasets are snapshots, not unique football matches.

New D1 stores (original archive is untouched):

| Binding | Database | UUID |
| --- | --- | --- |
| SPORTMONKS_RAW_0 | tiki_sportmonks_raw_20261029_0 | 515060cd-326d-4d3f-abe3-293eeda01d83 |
| SPORTMONKS_RAW_1 | tiki_sportmonks_raw_20261029_1 | 083ad6a5-ab9d-4414-b451-176b0491f8a5 |
| SPORTMONKS_RAW_2 | tiki_sportmonks_raw_20261029_2 | b83ffd3f-cc7b-4c0f-b229-40245ba41650 |

Apply `migrations/20261029_sportmonks_raw_archive.sql` to these stores only. Existing intermediate store 0 also received the priority column/indexes before rollout. The job manifest and daily reservation ledger live in store 0; raw page data rolls to the next store around 400 MiB.

## Running and stopping

`POST /api/internal/sportmonks-archive` accepts `{"action":"init"}`, `{"action":"step","pages":6}`, or `{"action":"status"}`, with the existing MODEL_TRAINING_TOKEN as a Bearer header. Credentials never enter client code or versioned files.

The history scheduler keeps its training trigger (`0 4,16 * * *`). A temporary `* * * * *` trigger drives up to 24 bounded export steps per invocation. It uses the existing server-side training credential. Remove the minute trigger after completion and keep the training trigger.

The exporter reserves at most 15,000 pages per UTC day, independently of public traffic, to leave substantial D1 write headroom. This is a conservative archive-only ceiling, not a claim about remaining account-wide quota. It resumes on the next UTC day after a budget pause. Indexed queue selection avoids repeatedly scanning the job manifest. Per-request batches and concurrent decoding are bounded to avoid Worker resource limits. A full shard set pauses explicitly.

## Completion criteria and remaining checks

Do not declare all Sportmonks data preserved or merge this branch solely because the job has started. Every manifest task must finish, blocked/retry tasks must be resolved or explicitly reported, page checksums must verify, and fixture ID coverage must be compared with the original archive and upstream pagination. Raw API JSON preserves image URLs; additional binary assets beyond the original sm_images table still require separate asset export/verification. The initial 43-task manifest is not evidence that every possible endpoint/include combination has been exhausted.

The provider's authenticated response on 2026-10-29 reported the trial ending at 2026-10-31 18:39:42 UTC. No purchase, subscription change or upgrade was performed.

Validation: 203 JavaScript tests passed, including gzip/checksum round trips, idempotent completion, rate-limit resumption and daily-budget pausing. Production export progress is held in archive_tasks; use its current values rather than this document as a completion report.

## Exit snapshot (2026-10-30)

Before leaving the Sportmonks trial the manifest was narrowed to what the model, the match page and later benchmarks can use, and the rest was marked `blocked` with `last_error={"skipped":"not_needed_before_sportmonks_exit"}`. All changes were D1 writes to `archive_tasks` in store 0; no code changed.

Kept (complete, records as counted by the exporter):

| Task | Records | What it holds |
| --- | --- | --- |
| fixtures-core | 47,922 | fixtures with participants, league, season, stage, round, venue, state, scores |
| fixtures-detail | 47,922 | events, statistics, lineups with details, formations, coaches, referees, periods, weather, metadata |
| fixtures-extra | 47,920 | pages 1-241: xGFixture, pressure, comments, trends, timeline, ballCoordinates, sidelined, expectedLineups, predictions, news. From page 242 only `predictions;expectedLineups` (the full set exceeded the 12 MiB page limit) |
| fixtures-sidelined | 47,920 | `sidelined.sideline`: injured and suspended players per fixture |
| fixtures-odds | 47,920 | `odds` filtered to market 1 (Fulltime Result), every bookmaker |
| fixtures-odds-goals (+ `-1b`, `-2`, `-2b`) | 47,920 (pages 1-1917) | `odds` filtered to markets 80 (Goals Over/Under) and 14 (Both Teams To Score), bookmakers 20 Pinnacle, 2 bet365, 9 Betfair, 23 Unibet, 29 WilliamHill, 28 bwin, 35 1xbet, 16 Marathonbet |
| odds-markets, odds-bookmakers | 202, 123 | id → name lists needed to read the odds |
| xg-teams | 247,610 | team xG per fixture |
| xg-players (+ `-below-1400m`, `-below-1300m`) | 571,800 + 55,800 + 92,340 | player xG (`/expected/lineups`) |
| standings-season-* | 233 seasons, 4,423 rows | official tables including deductions |
| players, teams, coaches, referees, venues, transfers, rivals, news, standings, types, leagues, seasons, stages, rounds and the other reference lists | see `archive_tasks` | as fetched on 2026-10-29 |

The export reached its terminal state at about 17:15 UTC on 2026-10-30: every task is `complete` or `blocked`. Stores 0 and 1 hold about 420 MB and 404 MB; store 2 is empty.

Skipped: predictions/value-bets/live-predictions endpoints (per-fixture predictions are in fixtures-extra), commentaries, in-play, premium and history odds, the unfiltered pre-match odds feed, premium markets/bookmakers, match-facts, team-rankings, cities (venues carry city names), and the per-season schedules and topscorers (derivable from fixtures and events).

### Split chains

Cursor pagination is sequential, so long tasks were split into parallel chains that start from a cursor at a known position:

- Player xG is ordered by `lineup_details.id` descending. `xg-players` was stopped once it passed id 1,400,000,000, `xg-players-below-1400m` once it passed 1,300,000,000, and `xg-players-below-1300m` ran to the provider's last page. Each stop happened after a whole batch, so a few hundred rows next to each boundary appear twice: deduplicate by the record `id`. Probes from 900M and 500M timed out without rows and are `blocked`.
- Goal-market odds use the fixture-id cursors that the completed `fixtures-odds` pass returned for pages 1044, 1305 and 1653 (same ordering, same `per_page`), and each chain's `page` continues that numbering. `fixtures-odds-goals` covers pages 1-1043, `-1b` 1044-1304, `-2` 1305-1652 and `-2b` 1653 to the end.

### Reading pages

Each `archive_pages` row holds one provider response as gzip (`payload_gzip`), with the exact request parameters in `params_json`. Decompress with any gzip reader (for example Python `zlib.decompressobj(31)`); `sha256` covers the decompressed JSON. Pages for a task can sit in any of the three stores.
