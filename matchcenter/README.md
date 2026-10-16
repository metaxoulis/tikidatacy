# Tiki-Data Match Center — D1 Logo Bridge (2026-10-16)

This package completes the interrupted Match Center logo integration without modifying the public Tiki-Data predictions website or the Poisson calculation engine.

## Files
- `worker.js`: Cloudflare Pages advanced-mode Worker deployed as `_worker.js`. Adds `GET /api/logos` from the existing D1 binding, injects `logo-bridge.js` before the existing Match Center app, and **preserves all previous API routes** by forwarding to the pinned reviewed deployment.
- `logo-bridge.js`: progressively enhances existing `TikiUI.emblem` controls using **verified** club / league image URLs, including an explicit Olympiacos/Olympiakos alias, and removes failed images to leave the local SVG placeholder visible.

## Existing systems (preserved)
- Cloudflare Pages project: `tiki-data-matchcenter` — https://tiki-data-matchcenter.pages.dev/
- D1 binding name: `DB`, database `tiki_data_lab`
- D1 source table: `logo_assets(entity_type,entity_key,display_name,logo_url,...)`
- Last reviewed baseline (immutable) deployment: `https://4751cad8.tiki-data-matchcenter.pages.dev` (the baseline contains the frontend and original read-only OpenFootball APIs)
- Original API contracts: `GET /api/summary`, `/api/matches`, `/api/matches/:id`, `/api/predictions`, `/api/model-status`.

The new endpoint `GET /api/logos` queries D1 at request time and returns `{ok,source,teams,leagues,counts}`. The bridge accepts image URLs **only from** `raw.githubusercontent.com` and `media.api-sports.io`, HTTPS required. Unknown names use the existing SVG shield/trophy. Logo images are club/competition trademarks and the source repository does not grant ownership or redistribution rights; display uses their original hosted image URLs. No image files are redistributed in this repo.

## Verification
The current database contains **137 club rows**, **17 league-season rows**, **143 distinct asset URLs**. SQL reconciliation verified all 137 distinct OpenFootball club names and all 17 dataset slugs match an existing DB logo record exactly.
Review preview: https://2eed142f.tiki-data-matchcenter.pages.dev/
Verified preview `/__tiki/health`: `api=connected`, `upstream_http=200`, `logos_ok=true`, counts 137/17. Cloudflare Browser Rendering populated 24 real match cards and visible logo-enhanced emblems on desktop and 390px mobile viewports without an API error.

## Deployment and maintenance
The project uses direct-upload Cloudflare Pages. Updating GitHub does **not** automatically update this production project. Deploy the complete contents of `matchcenter/worker.js` as `_worker.js` on a preview branch; test `/__tiki/health`, then deploy to branch `main` for production.

**Do not delete** the baseline deployment `4751cad8`: CSS, JS, and existing API requests are currently proxied to it so no prediction functionality is rewritten or lost. The architectural follow-up is to check the full original Pages Functions/asset source into this repository and remove the upstream dependency; do not mistake this bridge for a standalone backend export.

If the D1 logo query ever becomes unavailable, `/api/logos` returns HTTP 503 and existing match cards remain functional with local SVG emblems. Health returns 503 when either API or logos are disconnected.


## v15 — contrast fix
- The Match Center serves `/logo-contrast.css` and injects it **after** the upstream `styles.css`. Transparent logos sit on an off-white pearl/slate tile, with an outline and subtle shadow. The original logo pixels are not recolored.
- Keeps the D1-backed `/api/logos` endpoint and the immutable upstream API intact. Missing images still fall back to SVG.
- Preview-verified with 24 real match cards and 90 mapped emblem elements on both desktop and 390px mobile screens.
