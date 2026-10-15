# Tiki-Data Match Rows v10

A version-controlled Cloudflare Pages advanced-mode `_worker.js` frontend for `https://tiki-data.pages.dev/`.

## UI
- Full-width, compact match board instead of hero / card-based grid.
- **Each match displays Team — VS — Team horizontally** on desktop and mobile; time, competition, and model 1X2 estimates are aligned in compact columns.
- Responsive competition drawer, league/date/search/model-only filters, load-more pagination.
- Accessible match analysis modal with existing probabilities, goals and scoreline estimates. No invented forecasts.
- Real crests for a limited verified ID map (football-data.org); deterministic monogram fallback for all other clubs.
- The front-end avoids dependencies, cookies, tracking scripts, and proprietary fonts.

## Data and routing
The Worker serves `/`, `/predictions`, `/app.css`, `/app.js`, and `/favicon.svg` from one deployable source file.
It forwards the existing read-only `/api/*` contracts to the pinned **previous Cloudflare Pages deployment** `https://cc7f36f5.tiki-data.pages.dev`. It does not touch secrets, databases, the prediction model or the old deployment. To avoid upstream breakage, do not delete that reference until APIs have been migrated to a standalone service.

## Deploy
This is a Pages Direct Upload **advanced Worker**: deploy the content of `frontend/worker.js` as `_worker.js` with an empty static assets manifest to a review branch, validate, then use the production branch. It can also be deployed using Wrangler Pages if configured for the target project. Do not copy this into an unrelated Workers project without adapting the routes.

## Quality
- No synthetic fixtures unless specifically provided by a separate demo page (none here).
- Invalid 1X2 probabilities are suppressed rather than displayed.
- The site labels estimates as experimental and does not claim real-time live scores.
- Frontend UI and API should be checked on desktop and narrow mobile widths before releases.
