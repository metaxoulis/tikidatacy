# Research experiment: LLM-proposed recent form versus Poisson v6

Status: **REJECTED** as a production 1X2 feature. The live model's numeric probabilities were **not modified**.

## Provenance

A real Cloudflare Workers AI Llama 3.1 8B inference was run on a compact aggregate summary of prior, real time-split model measurements. It suggested inspecting (1) home team goals scored over its last five completed matches, and (2) away team goals conceded over its last five completed matches. The LLM was explicitly forbidden to manufacture results or probabilities, and was not fed the user's API token or unbounded raw data.

## Retrospective holdout evaluation

- Evaluation range specified: `2026-04-01` to `2026-10-01` (exclusive); four populated historical test months, **617** eligible licensed OpenFootball finished fixtures.
- Expanding chronological training fold boundaries, with 3-day embargo; recent-five counts used **only previous finished training games**. The experimental feature uses shrinkage toward league rates (six prior equivalent matches) and mild alpha=0.15 expected-goal adjustment to avoid overreaction.
- Baseline and experiment use identical existing Poisson rates, match set, and source-based scoring metrics apart from form adjustment.
- No tuning was performed on the holdout after viewing results; the single candidate was tested as generated.

| Metric | Historical Poisson | Form-augmented variant | Better |
|---|---:|---:|---|
| 1X2 accuracy | 49.43% | 48.46% | baseline |
| 1X2 Brier (lower better) | 0.6025 | 0.6029 | baseline |
| 1X2 Log loss | 1.0088 | 1.0091 | baseline |
| Over 2.5 Brier | 0.2386 | 0.2380 | form |
| BTTS Brier | 0.2445 | 0.2447 | baseline |
| 1X2 10-bin ECE | 0.0434 | 0.0639 | baseline |

Conclusions: form signals were **not adopted** because 1X2 Brier/log loss/calibration and accuracy all worsened slightly despite a small Over improvement. This is not a claim of statistical significance (617 fixtures are insufficient to establish a small difference reliably); it is a conservative deployment gate. Retest only in future rolling periods with more complete domestic Sportmonks history and a pre-registered candidate. No live odds, betting recommendations, post-kickoff events, premium odds, or future match information were used as pre-match explanatory variables.

## Integration policy

- Ingest the licensed, available Sportmonks historical feed by paginated windows with checkpoints; never send unbounded raw provider feeds to an LLM and expect it to train by itself.
- Keep source-labeled match outcomes and team history in D1; fit and validate numeric forecasts using time-safe feature engineering, backtesting and calibration.
- Workers AI is currently used for a verified **research recommendation**, not to alter published 1X2, GG or Over percentages.
- Additional model improvements must beat a clear benchmark on genuinely later fixture periods before entering the site.
