# Parallel Football-API trial

`/provider-check` shows independently labelled Sportmonks and Football-API.com feeds. The Live screen links to it. Existing `/api/live`, forecasts, provider identifiers and match details remain unchanged. No provider data is joined by numeric IDs or approximate club names.

The new adapter uses only `/matches/live.json`, `/matches/events.json` and `/matches/lineups.json`. It never calls Match Statistics or Commentary because general access to these products has not been established. All public and stored data is normalized through explicit field allowlists; provider responses can otherwise contain credential-bearing URLs.

## Bindings and migration

Apply `migrations/20261028_football_trial.sql` in a separate D1 database, bound as `FOOTBALL_TRIAL_DB`. Configure `FOOTBALL_API_KEY` and `FOOTBALL_API_KEY_SECRET` as secrets. The initial deployment uses database `tiki_football_api_trial` (`7cb16372-2a9a-45dc-9c7b-56c0e8607d1b`) in the existing account. Production and the review branch share this trial database and its budget; the original TIKI_DB is not modified.

## Request budget

The comparison browser polls once per 30 seconds, only while visible. The provider live response is cached in primary D1 for 30 seconds. Atomic cache leases deduplicate concurrent visitors across regions. Every attempted outbound call, including a failure, reserves one request in a UTC-day counter **before** fetching. The trial cap is 2,500 requests/day, below the purchased Pro allowance of 9,000. Calls from other applications or manual diagnostics are outside this counter. Storage or configuration failures stop upstream requests rather than bypassing the budget.

Detail requests are allowed only for matches already observed in the trial feed. Events cache for 120 seconds, lineups for 20 minutes, or 24 hours once the match is finished. Provider failures back off for two minutes. No automatic retry or redirect is followed. A full-day continuously viewed live feed alone can reach the trial cap; the UI then labels the cached response instead of causing overage.

## Persistence and verification

Observed match results are kept in the separate `football_trial_matches` table; finished results cannot regress to an in-play state. Events and lineups are saved only when requested from the comparison page. This is not an unattended collector of every finished match's details. `provider_updated_at` is distinct from the successful poll timestamp. In-play matches without a recent provider change are explicitly flagged rather than presented as verified fresh.

Tests cover normalization/credential stripping, provider ID separation, event chronology, concurrent cache deduplication, atomic quota exhaustion, denial backoff, and unauthorized match requests. Review mobile and desktop displays, real live data, detail requests, repeated cached requests and unchanged production endpoints before publishing.
