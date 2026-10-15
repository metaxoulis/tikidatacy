# Tiki-Data v13 — Premium Dashboard

Responsive HTML/CSS/JavaScript frontend for Cloudflare Pages, inspired by the user's sports analytics reference screenshots.

## Files
- `index.html`: semantic shell (topbar, competition sidebar, hero, featured match, stats, and match table)
- `styles.css`: responsive premium navy/mint UI, glass panels, compact mobile bottom navigation
- `app.js`: data binding, filters, date navigation, real odds-free statistical probabilities, bookmarks, details modal
- `brand.svg`: transparent traced silhouette of the **user-provided Tiki-Data logo** (no stock logo)
- `stadium.svg`: custom illustrative stadium backdrop

## Real data, no fake numbers
The UI requests `/api/fixtures` and uses `matches[]`, `p1/px/p2`, `over25/under25`, `btts/no_btts`, and `mu_home/mu_away`.
- Dashboard match/league/prediction counts are computed from the returned list.
- Team crests use known football-data.org IDs and generated vector crest placeholders for other clubs.
- League labels use initials as placeholders.
- Historical W/D/L form, possession and shots on target are **not supplied** by the existing API; the UI deliberately uses neutral placeholders/— instead of presenting invented results.
- The comparison panel labels Poisson `mu` values as **expected goals**, not observed averages.
- Percentages are model estimates, not sportsbook odds, live scores, or validated accuracy.
- Bookmarks are saved locally in the visitor's browser. Guest profile and notifications indicate no connected account/message service.

## Delivery & architecture
`../frontend/worker.js` bundles these files into one Cloudflare Pages advanced-mode Worker for direct deployment. 
Routes: `/`, `/predictions`, `/styles.css`, `/app.js`, `/stadium.svg`, `/brand.svg`, `/favicon.svg`.
The worker forwards read-only `/api/*` paths to the **previous pinned backend** at `https://cc7f36f5.tiki-data.pages.dev` so the current Poisson model and API bindings remain untouched. Do **not delete** that previous deployment until the API has been migrated into independent functions or a Worker.

The Cloudflare project currently uses Direct Upload, so merging GitHub does **not** itself trigger production deployment. For releases, deploy the bundled `frontend/worker.js` as the `_worker.js` part to `tiki-data` Pages, preview first, then use the production branch.

## QA
Check `/` and `/predictions` for desktop and 390px mobile widths. Verify the match API populates both, the stat panel distinguishes missing fields, league/day/search filters update matches, favorites persist, and the detail modal is keyboard-closeable. Never claim live-scores functionality without a source. 
