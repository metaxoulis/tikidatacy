# Match Intelligence: Sportmonks lineups, xG & historical form

## Overview

Mobile Match Center displays enlarged 1X2, score, goal markets, and actual provider xG. Tabs include **Info, Ανάλυση, Ενδεκάδες, Ιστορικό, Stats, AI Analysis**. Desktop match intelligence numeric typography is larger while the existing dashboard layout is preserved.

## Endpoint

`GET /api/match/sportmonks-{fixtureId}` returns a normalized, sanitized JSON object only when the fixture is in the existing verified seven-day Sportmonks schedule. The token stays in the existing Cloudflare encrypted `SPORTMONKS_API_TOKEN` binding. No token is exposed in UI or client requests.

The Worker fetches `fixtures/{id}` with a bounded cascade of `lineups`, `metadata`, `formations`, `statistics.type`, `xGFixture`, `lineups.xGLineup`, `expectedLineups` includes. It may also attempt fixture-scoped `expected/fixtures` and `expected/lineups` when xG is unavailable; unrecognized filters or subscription restrictions are safely ignored. **Never fetch an unscoped expected feed**. Every expected record must match the requested fixture ID.

- `metadata` type 572 / `LINEUP_CONFIRMED` determines a *tri-state* confirmed flag. `null` is unknown, not confirmation. `type_id=11` distinguishes actual starting players, `type_id=12` bench. Provider projected entries use `77614` / `77615`; predicted XIs are always described as **not confirmed**.
- For team/player xG, display only `type_id=5304` numeric values and never call them model forecasts. xG can be delayed and may require a paid add-on. Only show provided player names, never invented names or metrics.
- Historical recent form and head-to-head results are assembled from previously completed **OpenFootball CC0** and **Sportmonks** scores in D1. Matches on/after fixture day are excluded, and duplicate source identities are combined. Historical form does not automatically recalibrate model forecasts.
- Cloudflare Cache API holds sanitized per-fixture responses for 3 minutes; no raw provider JSON retained.
- Show graceful unavailable states for unlicensed/uncovered fixtures. Model outputs remain Poisson and are not silently replaced by bookmaker odds.

## Security and operational notes

- Rotate any provider token previously pasted in chats or URLs, updating the same Cloudflare Production secret after rotation. GitHub must contain no token.
- The deep-detail API validates the public fixture ID against a Sportmonks-verified, D1-cached slate to block arbitrary ID scraping. The route is GET-only.
- Lineup and xG availability vary by league, match state, latency, and Sportmonks subscription. Live score and fixture lists must continue working if premium extras fail.
- Provider data and the Poisson learning engine are separate; adding xG to model training is a future research task requiring leakage-safe backtesting.
