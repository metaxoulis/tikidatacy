# Provider continuity and complete fixture forecasts

The active match provider is Football-API.com. A different label in a diagram does not change the configured provider or API credentials.

Published historical Poisson weights, team identity aliases and model snapshots remain in Tiki-Data storage. Reading the published model first tries KV, then the D1 snapshot, then the previous published KV model. None of these reads calls Sportmonks.

Each fixture uses the verified Football-API-to-Sportmonks identity map before unique archived name aliases. Provider numeric IDs never directly enter the Sportmonks namespace. Missing team histories use partial-team, league or pooled historical priors and remain labelled as low or very low confidence. UEFA experimental output does not override its independent calibration review; it retains the withheld review and explicit experimental preview. A displayed prediction is not a validated accuracy claim.

The private training route refreshes locally stored assets, syncs finalized Football-API outcomes, and retrains from persisted history. The three-day cutoff and duplicate-match filtering remain in place. Team and competition crests are copied into local binary storage and served from /badges, /archived-badges and /league-logos. Public badge routes never call the provider or CDN. Maintenance may fetch a missing binary from the approved Sportmonks CDN, then persists it for future use.

The supplementary Sportmonks export is still separate from model operation. Its numeric page offset was limited to 20,000 records; the exporter now follows next_cursor and recovers a cursor from the last immutable saved page when resuming an older job. Completed exports must still be checked before declaring complete upstream preservation. Revoking Sportmonks access during that export prevents remaining upstream data from being fetched, although saved data and model inference remain available.

Validation: 209 JavaScript tests plus Python checks passed. Tests cover mapped identities, low-evidence predictions, unaltered UEFA validation, D1 model fallback, country-aware ambiguous-name rejection, and cursor recovery beyond 20,000 rows.
