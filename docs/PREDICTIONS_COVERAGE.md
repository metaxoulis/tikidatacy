# Predictions — complete coverage with transparent limits

All matches successfully returned by the SportAPI.ai 3-day feed and the AllSportsAPI selected UTC date receive numeric estimates for 1/X/2, Over/Under 2.5, and BTTS/No-BTTS. The app uses **separate provider selectors**, not guessed ID matching or a union with silent duplicate removal.

The tiered Poisson model operates as follows:
1. Preserve a valid SportAPI.ai team-standings estimate already computed for a selected fixture, clearly marked **experimental** (not calibrated).
2. Otherwise, use completed match results from the **same provider and competition** when each team has at least three earlier fixture observations in the loaded set; opponent scores from after kickoff are not allowed.
3. If no such team-specific evidence exists, return the intentionally identical **generic** prior \(\lambda_h=1.42, \lambda_a=1.16\). The output is marked **very low confidence** and **not personalized to either team**. This is mathematical coverage, **not** a claim of match-specific predictive ability or empirical accuracy.

A row that is already underway or finished is marked `retrospective:true`, which must never be represented as a verifiable prior pre-match forecast. The Poisson \(\lambda\) parameters describe assumed scoring rates, *not* measured match xG.

It would be misleading to describe the generic coverage as trained machine learning, xG-informed, optimized or accurate. Future improvements need licensed longitudinal season histories and held-out out-of-time evaluation (Brier/log loss/calibration).
