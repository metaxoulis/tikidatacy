# Real-data signal check: do recent shots on target add to recent goals?

First measurement on the real archive, run read-only inside D1 on 2026-10-30 with
`research/archive_sql_signal_check.sql`. It is **not** the PR #88 logistic model and changes nothing in
production; it answers one question before the full export exists: with the requested recency rule, does
one match statistic carry signal beyond goal form on matches the fit never saw?

Setup: 14,916 finished fixtures from 2025-07-01 to 2026-10-27; per team the last 8 games of the current
and previous season, 60-day half-life, ×0.55 for the previous season, 3-day embargo, at least 3 prior games
with statistics. Train: kick-offs before 2026-04-23 (8,116 fixtures). Holdout: 2026-07-27 to 2026-10-27
(3,091 fixtures). Each model is a table of training-fold rates (deciles, or a 5×5 grid), shrunk toward the
base rate; nothing is tuned on the holdout. Lower Brier is better.

| Target | Base rate | Goals form | Shots on target | Goals × shots on target | Gain vs goals (± 1 s.e.) |
|---|---|---|---|---|---|
| Home win | 0.24797 | 0.23038 | 0.22818 | **0.22611** | **+0.00427 ± 0.00132** |
| Over 2.5 | 0.24555 | 0.24142 | 0.24115 | 0.24090 | +0.00052 ± 0.00078 |
| BTTS | 0.24797 | 0.24594 | 0.24605 | 0.24629 | −0.00035 ± 0.00071 |

Reading: recent shots on target improve the home-win estimate by about three standard errors and pass the
0.002 Brier gate used in `archive_stats_shadow.py`. For Over 2.5 and BTTS the change is within noise.

Limits: one statistic, binned rates instead of a fitted model, home win rather than the full 1X2, and a
holdout that is the first three months of 2026/27 (including July qualifiers). The full test of all 54
statistics and xG still needs the archive exported to SQLite for `archive_stats_shadow.py`.
