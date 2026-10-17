# Sportmonks-only production cutover (17 Oct 2026)

Sportmonks Football API v3 is the only active fixture and inplay data supplier. Server-side Cloudflare Secret SPORTMONKS_API_TOKEN is never shipped to browsers, GitHub or logs. Previous commercial live API endpoints and handlers have been removed from the release Worker.

GET /api/home-focus discovers allowed league IDs for the next seven days, requests verified fixtures by date with fixtureLeagues filter, and validates home/away participants and country.
Only England, Spain, Germany, Italy, France, Greece, Cyprus. Cyprus 1. Division is verified by country.
All genuine upcoming fixtures are shown even when no probability estimate exists; the v2 model only publishes probabilities when licensed CC0 historical venue samples match both teams. Unmatched fixtures have null probabilities, never invented priors.
GET /api/live gets Sportmonks inplay matches with participants, scores, events and league; the page refreshes and displays scores only when both sides are supplied.
Image URLs under cdn.sportmonks.com/images are supported in server and CSP. Historical CC0 records and trained D1 snapshots are preserved.

Stage validation on October 17 returned HTTP 200 for leagues, fixtures and inplay; seven-day staged listing returned 57 fixtures and 57 pairs of team crest URLs over six leagues before correcting Cyprus recognition.
Prediction model remains experimental, unvalidated for prospective wagering results.