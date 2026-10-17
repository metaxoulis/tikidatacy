# SportAPI.ai — Optional Tiki-Data provider (v19)

## Secret handling

- NEVER put the key in GitHub, JS, HTML, client code, logs, query strings, or issue comments.
- Configure SPORTAPI_AI_KEY as a Cloudflare Pages encrypted secret in the tiki-data project.
- The Worker reads env.SPORTAPI_AI_KEY only server-side and calls https://sportapi.ai with the X-Api-Key header.
- The provided key was posted in a chat: rotate it and enter a NEW key only in the Cloudflare dashboard.

### Manual Cloudflare setup

1. Cloudflare Dashboard → Workers & Pages → tiki-data → Settings → Variables and Secrets.
2. Add variable SPORTAPI_AI_KEY of type Secret (encrypted), in Production; add Preview only for authenticated staging tests.
3. Paste the freshly rotated key in Cloudflare, NEVER in any repository file.
4. Redeploy the Pages Worker to activate the environment binding.

## Integration behavior

- A successful main /api/fixtures response remains the single source of existing Poisson-model predictions; no extra provider calls.
- If the main upstream fails, the Worker may call GET /api/fixtures/date/YYYY-MM-DD at sportapi.ai for the current UTC date.
- Fallback fixtures have namespaced IDs and null model probabilities/xG. Data is not invented.
- The result is cached for 15 minutes in a Cloudflare edge cache. Cache is per location, not globally coordinated: heavily visited sites need shared budget enforcement.
- 401 / 403 / 429 errors are not retried automatically. If the fallback fails the original upstream error response is returned.
- We do not expose arbitrary SportAPI proxy endpoints or a browser-accessible credential.
- Pinned original upstream https://cc7f36f5.tiki-data.pages.dev and existing front-end remain unchanged.
- This provider does not provide measured xG or 1X2 model probabilities.

## Test instructions

Run: node --test tests/sportapi-provider.test.mjs
Check the feature branch GitHub Actions preview CI before deploying.
Without a server-side Cloudflare secret, the additional provider is intentionally INACTIVE.
An authenticated request has not yet been verified. Do not claim it is active until an actual protected probe succeeds.

Reference: https://sportapi.ai/docs

## Verified authenticated live API response (2026-10-17)

- Production Cloudflare encrypted key authenticated successfully with header `X-Api-Key` and HTTP 200.
- Contrary to the generic docs examples, real `GET /api/fixtures/date/YYYY-MM-DD` has top-level `{success:true,date:...,data:[...]}`, **not** `{fixtures:[...]}`.
- The source adapter now parses `data[]`, `fixtures[]`, and `data.fixtures[]` without equating a missing field to zero fixtures.
- The observed live fixture rows contain `id`, `home_team`, `away_team`, `home_id`, `away_id`, `league_id`, `league_name`, `datetime`, `kickoff_utc`, `home_score`, `away_score`, and `status`; when kickoff is missing the UI adapter abstains rather than inventing the time.
- Confirmed 255 rows on 2026-10-17, 51 rows on 2026-10-15, and 487 rows on 2026-08-08. **These counts are not numbers of completed/scored fixtures.**
- Manual production provider probes were temporary and were removed from the deployed Worker after the verified parser fix.

## Historical training

SportAPI.ai provides potentially useful historical scores and match details. Before using any data to fit or commercially redistribute predictions, verify the provider's **storage, historical backfill and AI/model-training rights** for the account plan. Keep data from different sources separate with source IDs and collection timestamps; never overwrite OpenFootball archival rows. The research learning engine remains independently gated and must not claim improved accuracy merely because more fixtures are found.

To prevent unplanned daily quota consumption, this live fallback is called only after a failed primary API request. A scheduled central historical collector / D1 source table will be implemented only after licensing, stable date coverage, validation of final statuses and source freshness, and quota budgeting are confirmed.
