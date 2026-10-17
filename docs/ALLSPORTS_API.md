# AllSportsAPI provider — optional second data source

Source: https://allsportsapi.com/soccer-football-api-documentation (v2.1).

### Purpose
An **independent fixture explorer**, not an input to the validated prediction engine.
Users may choose SportAPI.ai or AllSportsAPI in Match Centre; neither provider's IDs or model outputs are silently mixed with the other. The existing SportAPI prediction/homepage routes remain unchanged.

### Secure configuration
Set **ALLSPORTS_API_KEY** as an encrypted *Production* secret on Cloudflare Pages project `tiki-data` under Settings → Variables and Secrets. Configure separately for Preview if authenticated preview is required. **NEVER commit the key, paste it in browser scripts, or expose it through status/JSON responses.** Redeploy after changing bindings.

The server uses `POST https://apiv2.allsportsapi.com/football/` with an application/x-www-form-urlencoded body containing `met=Fixtures`, `APIkey`, `from`, `to`, `timezone=UTC`. This avoids publishing the secret in the outbound request URL. Provider docs describe GET/POST. If POST is rejected, diagnose through a secure server-side test rather than moving credentials client-side.

### Public endpoints
- `GET /api/allsports/status`: reports only whether a Cloudflare secret is configured (no provider call).
- `GET /api/allsports/fixtures?date=YYYY-MM-DD`: one UTC day, ±15-day range, 15-minute cache today and 1-hour cache other days; bounded payload; 7.5s timeout; never forwards unknown parameters.

Provider returns no calibrated model probabilities. `AllSportsAPI` results are labeled by source and only show documented score/fixture fields. Missing licensed logos fall back to initials. Do not merge source IDs without verified joins. The API has per-plan league limits and quotas; caching limits normal traffic, but Cloudflare's edge caches aren't a global call-budget guarantee.

**Rights:** https://allsportsapi.com/terms-of-use.php says redistribution/storage is permitted subject to restrictions but also limits certain uses of materials and disclaims rights to third-party logos. Check plan/permission for public/commercial redistribution and individual team/league crest rights.

### Tests
`node --test tests/allsports-provider.test.mjs`; existing `node --test tests/*.test.mjs`.
