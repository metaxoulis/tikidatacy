# Candidate: European Strength Calibration (research only, 2026-10-21)

## Problem
The v11 Poisson model divides attack/defence by competition scoring averages
and iterates against opponent strength, but a club dominating a weaker domestic
league can still look equal to one dominating a stronger league. Domestic
scoring rates alone do not identify absolute cross-league quality. In the
October 20 audit Benfica had 17 away UEFA results versus Omonia's 56 home
results including domestic matches, so its published estimate was not an
equivalent-sample comparison. **Do not manually force Benfica to be favourite.**

## Implemented candidate (NOT published)
- `frontend/european-strength.mjs` fits a neutral 1500-point Elo-like anchor
  from **finished UEFA matches only**, using **stable provider team IDs**,
  three-day training embargo and strict chronological order. Venue adjustment
  and opponent-relative outcomes are used; duplicates are rejected.
- `frontend/worker.js` embeds the helper and attaches `european_strength`
  to new in-memory fitted model snapshots. No additional D1 queries, new
  tables, network requests or provider feeds are introduced.
- Optional `fhEstimate(...,{experimentalPreview:true,europeanStrengthPreview:true})`
  symmetrically adjusts goal rates by a bounded, sample-shrunk Elo differential.
  At least three completed UEFA appearances by **both** clubs are necessary.
  This does **not** change the default `fhEstimate` output, public fixture 1X2,
  live probabilities, model snapshot key or calibration/abstention gate.
- The feature is derived from observed historical UEFA results. It is **not
  an official UEFA club coefficient or ranking**. Country-league averages
  must not be mislabeled as measurements of all clubs in that league.

## Proposed official UEFA coefficient integration
1. Acquire authorized point-in-time **club coefficients** (not a current
   ranking applied retrospectively) with `published_at`, `valid_as_of`,
   source attribution and Sportmonks team ID mapping.
2. Only use coefficients **available before the prediction's information
   cutoff**. Never use coefficients updated with the match being predicted.
3. Evaluate league-country effects separately, because coefficients of
   European-qualifying clubs are not representative samples of a whole
   domestic league. Do not double-count the same UEFA results in Elo and
   coefficients.
4. Tune/compare: old v11; v11 + historical UEFA Elo; v11 + dated official
   coefficients; and v11 + both. Select parameters only on past training folds.

## Promotion criteria
- Preserve club identity audit (Greek Olympiacos != Cypriot Olympiakos).
- Train on all licensed eligible domestic + European finished results (UEFA
  matches can supply anchor signals even when excluded as test results).
- Walk-forward evaluation by real match date with three-day embargo, at least
  80 independent UEFA 1X2 outcomes, compare multiclass Brier **and** log loss
  with v11, paired confidence interval entirely below zero for Brier loss.
- Inspect calibration bins, sample coverage, home/away bias, league-specific
  error, and Benfica-like stress cases without target label leakage.
- Only then version a new snapshot, recompute it by bounded scheduled job,
  test a Pages preview, publish separately by Direct Upload. Repository PR
  merge does not deploy the production site.

## D1 preservation
The new experimental calculation runs entirely in-memory on records that
v11 training already loaded. The live endpoint remains KV-only; neither
live polls nor every visitor triggers backtesting or historical scans.
**No production D1 inspection/import/retrain was performed for this PR.**
