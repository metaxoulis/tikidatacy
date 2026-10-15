# Tiki-Data · Football Match Center

This repository hosts the experimental **Tiki-Data Match Center** and model-quality work. It is not connected to the production website.

- Preview: https://tiki-data-matchcenter.pages.dev/
- Quality service: https://tiki-data-model-qa.pages.dev/
- Data: [OpenFootball/football.json](https://github.com/openfootball/football.json) (CC0-1.0).

**Data warning:** OpenFootball is not a live source. Recent match scores may be missing; a successful download does not mean the dataset is complete. The preview currently uses an independent QA guard and withholds predictions if source freshness, recent coverage, or historical sample is insufficient.

**Model warning:** All accuracy results so far are *retrospective simulations*, not an independently verified record of predictions made before kickoff. No accuracy guarantees, betting advice or last-minute data guarantees.

## Safety

- Cloudflare production project `tiki-data` must never deploy automatically from this repository.
- All changes must be reviewed in an isolated preview first.
- Do not commit secrets, API keys, `.dev.vars`, or real user information.
- The full application and QA-specific sources are maintained on review branches.
