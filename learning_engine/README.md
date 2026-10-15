# Tiki-Data Learning Engine v1

**QA candidate training only — no automatic production model release.**

1. GitHub Actions fetches 17 allowlisted OpenFootball CC0 league/season datasets with SHA-256 checksums (2024/25 through 2026/27).
2. Parses final scores strictly; missing results are missing, not 0:0.
3. Runs chronological rolling Poisson (home/away goal strengths, time decay, empirical-Bayes shrinkage), with a three-day result buffer.
4. Selects hyperparameters by Brier score on 2025/26 validation and checks untouched 2026/27 holdout against baseline, recording log loss and first-pick accuracy.
5. Blocks candidate approval for less than 85% recent final-score completeness (21–3 days before run), weak results, or fewer than 100 *independently logged pre-match* predictions.
6. Archives candidate model weights/profiles and audit reports as GitHub Actions artifacts for manual review (30-day retention).

**Important:** All historical backtests use archives fetched *today*, not as-of archives recorded before those historical kickoffs. These scores DO NOT represent verified live accuracy. OpenFootball is not a live events or lineup provider. The existing `tiki-data.pages.dev` prediction engine is separate and untouched.

## Run locally

```bash
python -m unittest discover -s tests -v
python -m learning_engine.pipeline --output learning-engine-output
```

No third-party Python dependencies or secrets. Network access is needed only for ingestion. Workflow scheduling starts after this PR is merged to the default branch because GitHub Actions cron runs there; branch push/PR runs tests before approval.
