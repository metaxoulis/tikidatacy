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
