# Football-API.com primary provider

Schedule and live routes now use Football-API.com. `/provider-check` redirects to Live and public trial endpoints return 410. Archived Sportmonks results and the published Tiki model remain available; upstream Sportmonks ingestion is retired.

Live scores share a global 30-second D1 cache. Ten selected competition schedules share a 30-minute cache, with at most three pages per competition over the next seven days. Events and match statistics refresh on demand after two minutes, lineups after twenty minutes; finished matches cache all three for a day. Statistics are requested only for a match page, never for match lists. A transactional daily reservation ceiling of 8,500 requests protects the 9,000-request plan; failed calls count. User visits reuse shared data. No commentary requests are made.

Public match identifiers use Football-API fixture IDs, with a separate match namespace when the fixture ID is absent. Historical forecasts resolve both team names through unique archived aliases, reject ambiguous names, and only then use legacy team IDs inside the model. Football-API numeric team IDs never enter the Sportmonks identity namespace. Unmatched teams display facts without an invented forecast. UEFA forecasts retain the existing publication review and experimental preview distinction. Live forecasts use actual score/minute and archived fitted rates, without live-stat adjustment.

The existing Sportmonks model inputs and result archive are retained. The authenticated `/api/internal/train` route runs the scheduled training pipeline at 04:00 and 16:00 UTC. It first syncs finalized Football-API outcomes, maps teams through `fa_team_identity`, and trains from stored OpenFootball, Sportmonks and Football-API results. No Sportmonks upstream requests are made by that training route. The existing cutoff excludes results dated on or after UTC today minus three days, and duplicate competition/date/team fixtures are counted once.

Incomplete provider sync, missing historical sources or a failed snapshot write do not replace the published model. The prior published model is retained in KV at `tiki:published-model:v11:previous`. The separate `tiki_sportmonks_archive` database holds the wider archived data (including statistics, xG, lineups and images); the current score-based trainer reads the selected results in `tiki_data_lab`, not that wider archive. Existence of the archive does not establish that every available upstream record was exported.

Production verification on 2026-10-29 at 09:50 UTC: 12 Football-API results for October 26–28 were stored and audited, with zero unmapped teams. The published v11 model trained on 27,056 distinct results (23,025 Sportmonks and 4,031 OpenFootball), covering 1,152 teams. Those 12 new results were not yet eligible at the October 26 cutoff; future scheduled training consumes them once eligible, subject to deduplication. The previous 8,737-result model was retained. Home feed, live route, Transparency, a team badge and a competition logo returned HTTP 200 after deployment. No new accuracy claim is made.

The provider sends no positions or formations. Announced lineups are drawn on the pitch with positions taken from the same players' recent matches (archived Sportmonks lineups, matched by name, or by shirt number with a near-identical surname); a single starter without a recorded position is placed by elimination, and with more than one missing the lineup is listed instead. Match pages show Football-API match statistics (possession, shots, corners, fouls, cards and similar counts) where the provider records them; smaller competitions may have none, and the Stats tab is then empty. The provider's match xG (`expected_goals`, larger competitions only) is shown to three decimals in the xG panel, and the overview repeats the key counts (xG, possession, shots, shots on target, corners, cards) while a match is live or finished; live match pages refresh them every two minutes. Statistics and lineups of finished matches are stored by the scheduled training (`football_match_statistics`, `football_lineups`). API credentials stay in Cloudflare secret bindings and only whitelisted provider fields are cached or exposed.

Live data does not depend on visitors. Every minute the scheduler (`tiki-data-history-scheduler`, trigger `* * * * *`) runs a heartbeat. The Pages side reaches it through `/api/internal/live-refresh`, or through the archive call made by the scheduler that is currently deployed. Each heartbeat:
- keeps the 7-day schedule warm (30-minute copies);
- while a covered match is on, or kicks off within 15 minutes, refreshes the live feed twice a minute and the statistics of covered live matches every three minutes, with 25-second provider timeouts;
- otherwise makes no live request.

Visitors only read these copies. A visitor request asks the provider itself only when the live copy is over 90 seconds old, or a live match's statistics are over six minutes old, that is when the heartbeat has stopped. A match is judged frozen against the time the feed was fetched, so a slow or failed provider call keeps the last known matches visible; a copy over 15 minutes old hides them.

On a 26-match Saturday this is roughly 1,200 live-feed and 1,000 statistics requests, well inside the 8,500 daily ceiling.

`/api/home-focus`, `/api/live` and `/api/match/<id>` are served from the data centre's Cache API, stale-while-revalidate:
- A copy younger than 20 s (10 s for live) is returned as is.
- An older copy (up to ten minutes) is returned immediately while one rebuild per isolate runs in the background.

Visitors therefore never wait for the provider or for the model, which each isolate keeps in memory for a minute. A match page's events, lineups and statistics are requested in parallel.

A match counts as live while the provider reports "IN PLAY" or "ADDED TIME". Its clock may read "45+" or "90+" in added time, which counts as minute 45 or 90, and "PS" during a penalty shoot-out. A numeric minute past 90 is extra time. A live match is hidden as frozen only when its provider record has not changed for five minutes; on a busy Saturday (about 300 matches at once) the provider updates each record only every one to three minutes. With nothing in play, the live page lists the next kick-offs.

The live predictor mixes history with the match itself. It starts from each team's historical scoring rate, or the league or global average, and conditions on score and minute. When the match's provider statistics are at most eight minutes old it also uses them:
- With xG, each rate is shrunk towards the team's in-match xG rate, with the history weighted as two matches of play. The match then weighs 5% after ten minutes and a third at full time.
- Without xG, shots on target, shots, corners and possession shift only the split between the teams, up to ±30% and ramped in over 30 minutes, as the earlier Sportmonks live model did.
- A red-card difference shifts the split in both cases.

The blend weights are not yet validated.

Production check on 2026-10-29 at 21:13 UTC: three of four in-play matches (Everton–Newcastle, Fiorentina–Atalanta, AE Prat–Athletic Bilbao) returned 12 statistic types on `/api/match/<id>`; Gimnastica Torrelavega–UD Ourense returned none. `/api/live` reports `match_statistics_available: false` by design.
