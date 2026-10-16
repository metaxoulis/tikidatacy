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


## Research v2: penalized Dixon–Coles low-score correction

Added `learning_engine/advanced.py`, a no-dependency experimental model that **starts from the existing shrinkage/time-decayed Poisson team strengths** and fits a league-level low-score interaction parameter `rho`. The parameter is estimated from historical final scores via **bounded Newton–Raphson on a ridge-penalized log likelihood**. The joint Poisson score distribution is normalized and produces mutually consistent 1X2, Over/Under 2.5, BTTS, clean-sheet probabilities, expected goals and five likely scorelines.

Important safeguards: strict three-calendar-day result cutoff, minimum 80 prior league results and five venue results per team, no made-up predictions for unknown/promoted/cross-division opponents. Higher mathematical complexity alone does NOT imply better forecasts.

`pipeline.py` selects independent-Poisson parameters using retrospective 2025/26 validation, then evaluates Dixon–Coles **on the same prediction cohort** against that independent Poisson and on the **later 2026/27 holdout**. The advanced candidate cannot be promoted unless both Brier score and log loss improve by at least 0.002 on both periods, the fresh-results checks pass, and 100 independently recorded pre-match predictions exist. The comparison uses the latest fetched retrospective archive, **not** true archived pre-match snapshots.

**The public production predictions continue to use their existing independent API.** This new algorithm is a QA-only research candidate; it does not replace the API or change betting recommendations. GitHub Actions produces candidate and audit artifacts, never automatically deploys a model.

Data source is currently problematic: on 2026-10-16 the existing Cloudflare D1 `tiki_data_lab` contained 5,674 rows, 4,031 finished scores and latest scored fixture 2026-09-20. More advanced mathematics cannot compensate for missing results. Update and independently verify the source snapshots before discussing production use.
