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

## UX polish — v14

- Consistent inline **Lucide-style SVG icons** in the desktop sidebar, hero metrics, action controls, table favorites, and mobile bottom navigation (no icon font dependency).
- Static HTML skeletons render before JavaScript; `renderLoading()` reuses them on refresh while the real `/api/fixtures` request is pending. Subtle shimmer obeys `prefers-reduced-motion`; after a successful response all skeletons are removed and the table is populated.
- The recent-form field renders a restrained calendar-unavailable SVG empty state, without invented W/D/L series.
- JavaScript computes 1/X/2 leader, Over/Under 2.5 leader and BTTS Yes/No leader; the strongest available value gets a restrained mint outline in relevant views. Missing/tied paired values are not misrepresented as a winner.
- Bottom navigation on mobile uses translucent navy, `backdrop-filter: blur(16px)`, `-webkit-backdrop-filter`, and safe-area padding for notched phones.
- Existing data feed and predictive model are unchanged; the frontend remains a Cloudflare Pages advanced-mode Worker in `../frontend/worker.js`.

QA: test 390px and desktop routes `/` and `/predictions`; verify initial (no-JS) skeleton markup and that a completed API request removes placeholders. Check one match with absent model percentages and the form empty state. See reduced-motion mode.


## v15 — 2026-10-16: official image catalogue and logo contrast
- `logos.js` is a **static exported snapshot** of the 137 verified club URLs and 6 current-competition logo URLs in D1 `tiki_data_lab.logo_assets` (17 competition-season rows collapse to 6 visual marks).
- The source is loaded before `app.js`. Home, Predictions, match-table, hero, competition sidebar and mobile league tabs use it where team/competition names match. Explicit Olympiacos alias and unique suffix-normalized fallback avoid guessing when names differ. Unmatched clubs still use known football-data.org crest IDs or a local SVG fallback.
- New pearl/slate neutral backgrounds, subtle borders and controlled drop-shadows keep both dark and white marks legible in the dark Tiki-Data dashboard. Images are **not recolored**. On image load failure, JS removes only the broken overlay and reveals the placeholder.
- The advanced-mode Pages Worker bundles `logos.js` as a static route and allows the two image hosts in CSP; the Poisson API and pinned backend remain untouched.
- The snapshot does not update automatically with future D1 additions; refresh the generated logo catalog and redeploy the direct-upload Pages project to pick up additional teams.
- Club and league identities remain third-party trademarks; links to assets do not grant merchandising/redistribution rights.


## v16 — Independent overview and predictions pages
The frontend has two **separate HTML documents**, not merely two tabs hiding a single long table:
- `/` (from `index.html`): stadium hero with counts based on the real fixture feed, featured upcoming match, model/goal stats, and **exactly three** chronologically upcoming fixtures. No sidebar, dense table, or date/league filter blocks. Mobile still displays the featured comparison statistics.
- `/predictions` (from `predictions.html`): league sidebar, mobile league tabs, date filters, search, favorites, full 1/X/2 · O/U · BTTS table; shows 100 results initially and allows loading the rest. This page does not load the homepage hero or featured-match markup.

Shared `app.js` checks the path and only initializes elements found on that page. The global search on the homepage navigates to `/predictions?q=...` on Enter. Favorites direct links use `/predictions?filter=favorites`. Deep-link anchors on mobile open the visible league tabs.

Main navigation highlights `Αρχική` vs `Προβλέψεις` based on the **route**, not the selected filter. Hero counts, model probabilities, crests and API source remain unchanged. Empty upcoming schedules show an honest empty state instead of past fixtures.

Cloudflare Pages `frontend/worker.js` bundles both documents, serving distinct responses for `/` and `/predictions`; the existing read-only `/api/*` upstream is untouched. The project is still Cloudflare Pages Direct Upload, so a GitHub merge alone does not trigger a deployment.
