# Sportmonks sole-live-data deployment
One live football supplier: Sportmonks Football API v3. Historical independent-Poisson fitting still uses the already licensed, stored OpenFootball CC0 scores; those are not a live API provider.
- Cloudflare encrypted Production secret: `SPORTMONKS_API_TOKEN` (never save in code, URLs or public logs).
- One-week rolling fixture calendar across Top 5 leagues, Greece and Cyprus using verified country/league inclusion; Sportmonks CDN supplies crest/league images.
- In-play scores are fetched from Sportmonks and served separately at `/api/live`. A live fixture never inherits a pre-match probability as a live model.
- Forecast probabilities display only if real team-specific history supports both teams, otherwise null/not available.
- Previous public live-data endpoints return HTTP 410 Gone. The unused legacy adapter code remains pending independent dead-code cleanup; it is unreachable and no old provider secrets are configured.
- D1 `openfootball_matches`, `focus_model_snapshots`, and `prospective_forecast_log` are retained as owned historical model training and evaluation stores.
- Short-lived `sportapi_home_cache` SQL table is reused under new non-legacy cache key `focus_sportmonks_v1` to avoid risky migration; its naming is historical, not an active connection.
- Do not count old 2025-26 retrospective validation as certified prospective accuracy. `validated:false`.

## Historical API integration (Sportmonks shared secret)

These new read-only routes use **the same** existing encrypted `SPORTMONKS_API_TOKEN` as fixtures and live scores. No API token ever goes in browser JavaScript or public URLs.

- `GET /api/history/fixtures?start=2026-10-10&end=2026-10-16&page=1` normalizes **final scores only**, filtered to the verified leagues (Top 5, Greece, Cyprus). Requests are limited to a 7-calendar-day inclusive window and pagination of 50 records per page (pages 1–10); dates are validated. `has_more` must be respected.
- `GET /api/history/odds/summary?page=1` queries Sportmonks `odds/premium/history` using `include=odd` and provides an **aggregate, non-redistributive summary** (count, range of offered prices and update timestamps). It does not expose raw bookmaker lines or suggest that odds are statistical model probabilities. A 403 means the optional Premium Odds subscription is unavailable. The published provider docs say premium history can be retrieved for **up to seven days after kickoff**, not unrestricted years of bookmaker archives.
- Requests use short-lived edge caching (300 seconds) and share the strict upstream host/redirect guard and authorization header.
- Historical fixtures are **not automatically merged into the CC0 Poisson training tables**. Only do this after verifying the applicable Sportmonks license and setting up a correctly audited, time-split import/backtest. Public endpoints must never change training data or silently improve reported accuracy.
- The token previously pasted into chat should be rotated in Cloudflare; replace the existing `SPORTMONKS_API_TOKEN` secret without adding credentials to git.
