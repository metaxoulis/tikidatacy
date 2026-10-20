# Forecast identity and evidence repair

The production Benfica forecast used only 17 away UEFA results while Omonia's
56 home results included its domestic league. The same model merged Greek
Olympiacos with Cypriot Olympiakos and split several OpenFootball/Sportmonks
name variants. These are data-integrity problems, not evidence that a particular
club should receive a manually selected probability.

Version 11 separates the two Olympiakos clubs, unifies observed spelling
variants, and keys commercial-provider observations by Sportmonks team ID.
Legacy names bridge to an ID only when unambiguous. Future observations cannot
influence a past training run's identity registry.

The scheduled UEFA history refresh now rotates across all upcoming clubs,
requests up to two years of available finished history, and persists normalized
scores from every cached club before fitting the next model. It retains the
three-day embargo and does not add domestic leagues to the public UEFA filter.
Provider entitlements and incomplete pagination can still limit coverage.

The audit recovered 975 unique cached completed fixtures across the upcoming
UEFA clubs; 907 pass the training embargo. Existing rows are updated by fixture ID; new rows retain both team
IDs. Goals, shots and possession displayed in analysis remain factual evidence;
their mere availability does not establish predictive skill.

UEFA numeric forecasts are withheld while cross-competition calibration lacks
an independent accepted evaluation. A publication flag alone cannot bypass
the sample-size, scoring-rule and paired-interval checks. Both relevant venue
samples also need at least six domestic results. Fixtures and descriptive
statistics remain visible with an explicit review notice. Provider probabilities,
retired recovery snapshots and browser caches cannot substitute for a withheld
model estimate.

An exploratory September/October chronological check on 90 UEFA matches did
not demonstrate improvement after identity repair. This is not a prospective
accuracy claim. No new numerical method is promoted as an accuracy upgrade.

Rebuild embedded assets with `python scripts/sync-worker-assets.py` and run
`node --test tests/*.test.mjs`. Apply the additive team-ID migration before
publishing version 11. Publish the fitted v11 model only after its inputs have
been repaired; maintain the UEFA abstention gate until evaluation passes.
