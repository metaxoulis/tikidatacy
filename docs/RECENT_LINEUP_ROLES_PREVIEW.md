# Recent formations and positions (preview-only proposal)

This draft adds read-only player-role inference and a possible starting XI to the Football-API.com match detail view. It does **not** publish forecasts, modify the score-based model, or promote a preview to production.

## Strict provenance
- Prefer the actual player lists supplied by Football-API.com. Preserve their provider player IDs, names, jersey numbers and starter/bench classification.
- The Football-API player API lacks verified roles/formations. Historical **position labels** are inferred solely from names matched *within the same mapped Sportmonks team* and historical formation fields. Player IDs are never matched between the two providers.
- Football-API abbreviates first names (`M. Sannadi`) while Sportmonks keeps them (`Maroan Sannadi`), so a provider name matches a recent player by full name, or by surname plus first initial; the shirt number only breaks ties. Anything still ambiguous stays without a position.
- Sportmonks numbers `formation_field` rows per formation (1 goalkeeper, 2 defence, last row attack). Row 4 is the striker line in 4-3-3/4-4-2 but the attacking-midfield line in 4-2-3-1, so rows are read against that match's own formation. Bench rows have no formation field; their Sportmonks `position_id` group (goalkeeper/defender/midfielder/attacker) is used instead.
- When no provider starter list exists, examine up to eight of the team's most recent eligible finished fixtures, using only the current and preceding season and no fixture within three days of the target kickoff.
- Emit a projected XI only if at least three eligible prior fixtures each have a usable ten-or-more-player starting XI, at least 11 distinct starters exist, a goalkeeper can be identified, and the latest evidence is less than 60 days old. The XI fills the usual formation's defence, midfield and attack with the most frequent recent starters for each line. No injuries, fitness, transfer updates, suspensions or official confirmation are inferred. A formation is shown only if repeated at least twice in the historical sample, and always as an estimate.
- The Sportmonks archive stopped growing when that subscription ended (last archived results: 2026-10-28). Since then the scheduled training job also stores Football-API lineups (see below), and who starts is judged on the eight newest complete games from either source. Positions and formations still come only from the archive: a stored `M. Sannadi` joins the archived `Maroan Sannadi` by the same name rules and keeps his position, while a player new since the archive has no position. The formation is shown only while at least two archived games remain among the eight newest.
- The history-backed projection is labelled *Πιθανή ενδεκάδα Tiki-Data* and historical position labels remain expressly non-official even if today's starter list comes from the provider.
- If identities, history or starter samples are insufficient, the UI leaves information unavailable instead of guessing.
- Lineups and guessed positions are for display only. They do not modify 1X2, over/under or BTTS probabilities.

## Pitch and club colours
When all eleven starters have a historical position and exactly one is a keeper, the lineup is drawn on the half-pitch: in the usual formation when the players' defence and attack counts fit it, otherwise in the shape their positions make. Within a line players run from the team's left flank to its right, taken from the archived `formation_field` column (Sportmonks counts home columns from the right touchline and away columns from the left). Otherwise the list stays.

Tokens are SVG shirts in the club's traditional colours from `frontend/team-kits.mjs` (plain, stripes, hoops, halves or centre band), keyed by Football-API team ID and listed only for clubs whose colours are well known; others keep the neutral token. When both clubs' main colours are close, the away club is shown in its second colour. The page says these are club colours, not necessarily the kit worn in the match.

## Stored Football-API lineups
`faSyncLineups` runs inside the 4-hourly scheduled training, after the new model is published, and never fails that run. It asks Football-API for the lineups of matches already stored in `football_training_results`, newest first, at most 16 per run in about 20 seconds (roughly 100 requests a day of the shared 8,500 budget). A lineup cached by a match-page visit on match day is reused. Empty answers are retried up to three times, 12 hours apart. Rows go to `football_lineups` (starters and bench as `{id,name,number}`), attempts to `football_lineup_fetches`.

## Deploy preparation
Apply both migrations **before** uploading a bundle that contains this code:
- `migrations/20261030_football_lineups.sql` to `TIKI_DB` (`tiki_data_lab`): the two new tables. Without them the sync reports `failed` and match pages fall back to the archive alone.
- `migrations/20261030_sportmonks_archive_team_dates.sql` to `SPORTMONKS_ARCHIVE_DB` (`tiki_sportmonks_archive`): team-date indexes. Without them each match page reads tens of thousands of archive rows per team, which the D1 free plan's 5 million daily reads cannot sustain. Match-page evidence is also cached per team for the day.

The current Cloudflare Pages **production** environment binds the original archived database as `SPORTMONKS_ARCHIVE_DB`; **preview does not**. This draft never touches that account configuration. Until a read-only preview binding is explicitly reviewed, previews will gracefully show existing Football-API lineups without historical estimates.

The Cloudflare Worker embeds `frontend/football-primary.mjs` and `frontend-v13/mobile-ui.js`. Rebuild the compiled `frontend/worker.js` using:

```sh
python scripts/sync-worker-assets.py
node --test tests/recent-lineup-evidence.test.mjs tests/football-lineups.test.mjs tests/football-primary.test.mjs tests/worker-bundle-parity.test.mjs
```

The generated Worker **has been rebuilt and committed in this draft branch**, and the GitHub regression checks pass. The changes are **not deployed** to a live Cloudflare preview yet. A read-only preview D1 binding for `SPORTMONKS_ARCHIVE_DB` must be reviewed before the projected historical data can appear in that preview.
