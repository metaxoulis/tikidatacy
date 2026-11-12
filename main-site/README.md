# Tiki-Data main site — Premium v7
This folder holds the **main-site frontend**, not the separate experimental Match Center.

**User-facing changes:** brighter slate-blue/mint design; responsive glass-like cards; replaceable SVG team/league crests; model probability bars for 1/X/2; and default exclusion of matches with missing/incoherent predictions.

**Data policy:** probability values remain exactly as supplied by the existing `/api/fixtures` service. Numbers shown are **model probabilities, not bookmaker odds**. This patch does not claim accuracy, increase source coverage, or introduce live data. Invalid or missing predictions are hidden rather than fabricated. The preview/demo query `?demo=1` still uses synthetic example fixtures.

**Backend safety:** the Cloudflare Pages live Worker and secret bindings are unchanged. The live frontend currently loads assets from a Cloudflare KV namespace via `tiki-v6-...` keys. Changes require deliberate review and a backup before promotion; **merging this pull request alone does not redeploy the production site**.

### Checks
```sh
cd main-site
npm run check
npm test
```

To replace placeholder crests with licensed official image URLs, edit the `TEAM_LOGOS` and `LEAGUE_LOGOS` maps in `assets/components.js`.
