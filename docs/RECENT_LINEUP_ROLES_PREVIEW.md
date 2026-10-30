# Recent formations and positions (preview-only proposal)

This draft adds read-only player-role inference and a possible starting XI to the Football-API.com match detail view. It does **not** publish forecasts, modify the score-based model, or promote a preview to production.

## Strict provenance
- Prefer the actual player lists supplied by Football-API.com. Preserve their provider player IDs, names, jersey numbers and starter/bench classification.
- The Football-API player API lacks verified roles/formations. Historical **position labels** are inferred solely from names matched *within the same mapped Sportmonks team* and historical formation fields. Player IDs are never matched between the two providers.
- Football-API abbreviates first names (`M. Sannadi`) while Sportmonks keeps them (`Maroan Sannadi`), so a provider name matches a recent player by full name, or by surname plus first initial; the shirt number only breaks ties. Anything still ambiguous stays without a position.
- Sportmonks numbers `formation_field` rows per formation (1 goalkeeper, 2 defence, last row attack). Row 4 is the striker line in 4-3-3/4-4-2 but the attacking-midfield line in 4-2-3-1, so rows are read against that match's own formation. Bench rows have no formation field; their Sportmonks `position_id` group (goalkeeper/defender/midfielder/attacker) is used instead.
- When no provider starter list exists, examine up to eight of the team's most recent eligible finished fixtures, using only the current and preceding season and no fixture within three days of the target kickoff.
- Emit a projected XI only if at least three eligible prior fixtures each have a usable ten-or-more-player starting XI, at least 11 distinct starters exist, a goalkeeper can be identified, and the latest evidence is less than 60 days old. The XI fills the usual formation's defence, midfield and attack with the most frequent recent starters for each line. No injuries, fitness, transfer updates, suspensions or official confirmation are inferred. A formation is shown only if repeated at least twice in the historical sample, and always as an estimate.
- The Sportmonks archive stopped growing when that subscription ended (last archived results: late October 2026). Projected XIs therefore lapse about two months later unless newer lineups are archived from another source; positions for announced players keep working from the archived season.
- The history-backed projection is labelled *Πιθανή ενδεκάδα Tiki-Data* and historical position labels remain expressly non-official even if today's starter list comes from the provider.
- If identities, history or starter samples are insufficient, the UI leaves information unavailable instead of guessing.
- Lineups and guessed positions are for display only. They do not modify 1X2, over/under or BTTS probabilities.

## Deploy preparation
The current Cloudflare Pages **production** environment binds the original archived database as `SPORTMONKS_ARCHIVE_DB`; **preview does not**. This draft never touches that account configuration. Until a read-only preview binding is explicitly reviewed, previews will gracefully show existing Football-API lineups without historical estimates.

The Cloudflare Worker embeds `frontend/football-primary.mjs` and `frontend-v13/mobile-ui.js`. Rebuild the compiled `frontend/worker.js` using:

```sh
python scripts/sync-worker-assets.py
node --test tests/recent-lineup-evidence.test.mjs tests/football-primary.test.mjs tests/worker-bundle-parity.test.mjs
```

The generated Worker **has been rebuilt and committed in this draft branch**, and the GitHub regression checks pass. The changes are **not deployed** to a live Cloudflare preview yet. A read-only preview D1 binding for `SPORTMONKS_ARCHIVE_DB` must be reviewed before the projected historical data can appear in that preview.
