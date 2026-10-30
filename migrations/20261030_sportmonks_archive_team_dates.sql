-- Apply to the archive bound as SPORTMONKS_ARCHIVE_DB (tiki_sportmonks_archive), BEFORE deploying match-page lineups.
-- sm_fixtures_teams(home_id,away_id) cannot seek on away_id, so "home_id=? OR away_id=?" read every archived
-- fixture (tens of thousands of rows) per team on each match page. These let both lookups read only that team's games.
CREATE INDEX IF NOT EXISTS sm_fixtures_home_date ON sm_fixtures(home_id,starting_at);
CREATE INDEX IF NOT EXISTS sm_fixtures_away_date ON sm_fixtures(away_id,starting_at);
