# Archive statistics: read-only shadow experiment

This is **research only**, not a deployed model or claim of better accuracy.
PR #87 (three-match Transparency statistics pilot) is untouched. The
production v11 trainer, its published forecasts, Football-API usage quota,
and the resumable Sportmonks export are also untouched.

## Verified inputs (2026-10-30)

`tiki_sportmonks_archive` contains 47,918 fixtures, 2,161,572 statistic
rows across 54 named match-statistic types, and 229,488 xG rows in 13 typed
categories. Statistical fixture coverage is 34,342, with 11,378 fixtures
having xG rows. Lineups span 37,039 matches. These are *archive row counts*,
not a claim that every provider feed or historical season is complete.

## Running

Export a **local SQLite copy** of the archived D1 database using an
authorized, read-only export route. Never commit it, credentials, or
provider payloads. The script never connects to Cloudflare, never trains
production, and never sends data to third parties.

```bash
python -m pip install numpy scikit-learn
python -m unittest tests.test_archive_stats_shadow
python -m research.archive_stats_shadow archive.sqlite --asof 2026-10-30 \
  --output shadow-report.json
```

The algorithm discovers every observed statistic and xG type rather than
hard-coding possession/shots alone. Training fixtures **and their historical feature sources** are limited to the current football season plus the immediately previous season relative to the training as-of date. Per-team features use up to the last eight finished games from **only the target season and the immediately previous season** (a July-to-June football-season boundary). Every source match must have kicked off at least three days before the target fixture. Values are time-weighted with a 60-day half-life, and the previous season receives a further 0.55 multiplier; newer current-season information dominates. Older games are excluded from feature history rather than given a tiny residual weight. Each statistic has a rolling mean and an observed-data
coverage indicator; missing values are never interpreted as zero.
Completed-game statistics cannot enter the features for that same game.

Baseline: rolling historical goals-for/against only. Candidate: those
same goal features plus all historical statistic/xG features. Both use
identical matches and chronological train/validation/holdout partitions.
Regularization is chosen on validation only. Models are independently
tested for 1X2, Over 2.5 and BTTS. Report gives Brier/log-loss gains on
the untouched later holdout; any negative gain blocks further review.

## Limitations and release gates

- This script has **not yet been fit on a full exported SQLite copy**.
  There is currently no observed holdout uplift to report.
- The archival source's pre-match availability, team-ID mapping to
  Football-API.com, competition heterogeneity, quality of individual xG
  categories, historical revisions and licenses must be audited first.
- Some records carry future dates or non-finished statuses. This tool
  only includes explicit final states and excludes the last three days.
- A more rigorous comparison to the existing published v11 model must use
  independently timestamped historical *pre-match predictions* and the
  exact same fixture set. The goal-form comparator here is a research
  ablation, **not** the production v11 baseline.
- No live model, UI, forecasts, cron, or database schema is changed by
  this branch. Promotion requires holdout gains, calibration checks,
  source completeness and explicit review.
