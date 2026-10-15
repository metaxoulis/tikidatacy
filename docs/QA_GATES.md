# Model quality gates (preview only)

The deployed Match Center routes prediction requests through an isolated QA service at https://tiki-data-model-qa.pages.dev/. The historical code in `model.js` is not the complete v0.3 QA deployment.

A prediction must be **withheld** for stale data (>360 minutes), less than 85% scored recent fixtures in a 21-day window (excluding the last three days), too few historical results, missing venue samples, an already completed match, or an unverified same-day kickoff time.

OpenFootball does not supply minute-to-minute news, lineups or live statistics. Recent results can be missing despite frequent sync. Past backtests are retrospective and not independently validated live accuracy. No guarantees; do not show stale predictions.

**Do not connect this repository to production `tiki-data` deployment.** Cloudflare deployment remains manual pending verification.
