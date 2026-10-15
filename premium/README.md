# Premium UI overlay — Tiki-Data Preview Only

This review branch contains a standalone presentation-layer enhancement for the existing Tiki-Data Match Center. The overlay uses an original replaceable SVG crest placeholder for each club/league, a brighter slate-blue and cyan/mint design palette, restrained glassmorphism, refined cards and probability bars.

The Cloudflare gateway forwards all API requests to the existing **quality-gated** QA preview, so missing/stale results still suppress forecasts. **Do not connect to the production `tiki-data` Pages project.**

OpenFootball is not a live scoring feed. All probabilities are experimental model estimates, not bookmaker odds. No new secret, subscription or provider was added. CSS is in `premium.css`, icons in `premium-icons.js`, and the isolated Worker in `worker.js`.

To replace placeholders with licensed team badges, edit the `add()` function in `premium-icons.js` (or the more modular source package) to use your own asset URLs; no official crests are included.
