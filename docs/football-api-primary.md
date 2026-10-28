# Football-API.com primary provider

Schedule and live routes now use Football-API.com. `/provider-check` redirects to Live and public trial endpoints return 410. Archived Sportmonks results and the published Tiki model remain available; upstream Sportmonks ingestion is retired.

Live scores share a global 30-second D1 cache. Ten selected competition schedules share a 30-minute cache, with at most three pages per competition over the next seven days. Events refresh on demand after two minutes, lineups after twenty minutes. A transactional daily reservation ceiling of 8,500 requests protects the 9,000-request plan; failed calls count. User visits reuse shared data. No statistics or commentary requests are made because statistics entitlement was denied by the provider.

Public match identifiers use Football-API fixture IDs, with a separate match namespace when the fixture ID is absent. Historical forecasts resolve both team names through unique archived aliases, reject ambiguous names, and only then use legacy team IDs inside the model. Football-API numeric team IDs never enter the Sportmonks identity namespace. Unmatched teams display facts without an invented forecast. UEFA forecasts retain the existing publication review and experimental preview distinction. Live forecasts use actual score/minute and archived fitted rates, without live-stat adjustment.

The existing model and result archive are retained. The previous scheduled Sportmonks training job returns `archived_model_retained`; training a new model from Football-API historical outcomes is separate work. No new accuracy claim is made.

Lineups are displayed as player lists because this provider does not establish player positions or formations. Match statistics and xG remain explicitly unavailable. API credentials stay in Cloudflare secret bindings and only whitelisted provider fields are cached or exposed.
