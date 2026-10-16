# Model quality gates (preview only)

The deployed Match Center routes prediction requests through an isolated QA service at https://tiki-data-model-qa.pages.dev/. The historical code in `model.js` is not the complete v0.3 QA deployment.

A prediction must be **withheld** for stale data (>360 minutes), less than 85% scored recent fixtures in a 21-day window (excluding the last three days), too few historical results, missing venue samples, an already completed match, or an unverified same-day kickoff time.

OpenFootball does not supply minute-to-minute news, lineups or live statistics. Recent results can be missing despite frequent sync. Past backtests are retrospective and not independently validated live accuracy. No guarantees; do not show stale predictions.

**Do not connect this repository to production `tiki-data` deployment.** Cloudflare deployment remains manual pending verification.


### Numerical model research (v2)

The separate `learning_engine/advanced.py` Dixon–Coles method fits an interaction for low-scoring matches using ridge-regularized Newton iterations and a complete score probability matrix. Outputs can be used only after prospective validation, source freshness checks and side-by-side holdout comparison to the existing simpler Poisson model.

Required release blockers: result archive more than seven days old; less than 85% recorded recent finals; insufficient training or chronological holdout coverage; no improvement of at least 0.002 in both multi-class Brier and log loss on validation and later holdout; fewer than 100 independently timestamped forecasts made before matches begin. This research candidate is never auto-deployed by the training workflow.
