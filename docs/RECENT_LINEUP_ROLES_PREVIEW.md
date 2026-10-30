# Recent formations and positions (preview-only proposal)

This draft adds read-only player-role inference and a possible starting XI to the Football-API.com match detail view. It does **not** publish forecasts, modify the score-based model, or promote a preview to production.

## Strict provenance
- Prefer the actual player lists supplied by Football-API.com. Preserve their provider player IDs, names, jersey numbers and starter/bench classification.
- The Football-API player API lacks verified roles/formations. Historical **position labels** are inferred solely from uniquely matching names *within the same mapped Sportmonks team* and historical formation fields. Player IDs are never matched between the two providers.
- When no provider starter list exists, examine up to eight of the team's most recent eligible finished fixtures, using only the current and preceding season and no fixture within three days of the target kickoff.
- Emit a projected XI only if at least three eligible prior fixtures each have a usable ten-or-more-player starting XI, at least 11 eligible unique player names exist, a goalkeeper can be identified, and the latest evidence is less than 185 days old. No injuries, fitness, transfer updates, suspensions or official confirmation are inferred. A formation is shown only if repeated at least twice in the historical sample.
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

The generated Worker is not yet rebuilt in this branch, so it is **not** a runnable deployed preview. The source modules and regression tests are prepared for the review/build step.
