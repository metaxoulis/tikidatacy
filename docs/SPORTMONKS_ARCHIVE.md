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

The history scheduler retains training at `0 4,16 * * *`. A temporary `* * * * *` trigger drives up to 24 bounded export steps per invocation. It uses the existing server-side training credential. Remove the minute trigger after completion, retaining `0 4,16 * * *`; do not remove the normal training schedule.

The exporter reserves at most 15,000 pages per UTC day, independently of public traffic, to leave substantial D1 write headroom. This is a conservative archive-only ceiling, not a claim about remaining account-wide quota. It resumes on the next UTC day after a budget pause. Indexed queue selection avoids repeatedly scanning the job manifest. Per-request batches and concurrent decoding are bounded to avoid Worker resource limits. A full shard set pauses explicitly.

## Completion criteria and remaining checks

Do not declare all Sportmonks data preserved or merge this branch solely because the job has started. Every manifest task must finish, blocked/retry tasks must be resolved or explicitly reported, page checksums must verify, and fixture ID coverage must be compared with the original archive and upstream pagination. Raw API JSON preserves image URLs; additional binary assets beyond the original sm_images table still require separate asset export/verification. The initial 43-task manifest is not evidence that every possible endpoint/include combination has been exhausted.

The provider's authenticated response on 2026-10-29 reported the trial ending at 2026-10-31 18:39:42 UTC. No purchase, subscription change or upgrade was performed.

Validation: 203 JavaScript tests passed, including gzip/checksum round trips, idempotent completion, rate-limit resumption and daily-budget pausing. Production export progress is held in archive_tasks; use its current values rather than this document as a completion report.
