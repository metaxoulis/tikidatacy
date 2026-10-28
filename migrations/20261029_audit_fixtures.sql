-- Finished fixtures for the Transparency audit, stored so the page needs no live provider:
-- Sportmonks-era matches copied from the archive (ids "sportmonks-<id>"), then every finished
-- Football-API match from the scheduled results sync (ids "football-api-fixture-<id>").
-- Scores are 90-minute (regulation) scores.
CREATE TABLE IF NOT EXISTS audit_fixtures (
 fixture_id TEXT PRIMARY KEY,
 league_key TEXT NOT NULL,
 kickoff TEXT NOT NULL,
 home TEXT NOT NULL,
 away TEXT NOT NULL,
 home_logo TEXT,
 away_logo TEXT,
 status TEXT NOT NULL,
 home_score INTEGER CHECK(home_score BETWEEN 0 AND 30),
 away_score INTEGER CHECK(away_score BETWEEN 0 AND 30),
 source TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_fixtures_kickoff ON audit_fixtures(kickoff);
