-- Finished Football-API results for model training. Football-API match IDs are a separate namespace from
-- Sportmonks fixture IDs, so they get their own table. home/away_team_id hold the model's archived
-- Sportmonks team identity, resolved through fa_team_identity; unmapped teams are never stored.
CREATE TABLE IF NOT EXISTS fa_team_identity (
 fa_team_id INTEGER PRIMARY KEY,
 sportmonks_team_id INTEGER NOT NULL,
 team_name TEXT NOT NULL,
 matched_by TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS football_training_results (
 fa_match_id INTEGER PRIMARY KEY,
 dataset_slug TEXT NOT NULL,
 league_key TEXT NOT NULL,
 match_date TEXT NOT NULL,
 home_team TEXT NOT NULL,
 away_team TEXT NOT NULL,
 home_team_id INTEGER NOT NULL,
 away_team_id INTEGER NOT NULL,
 home_score INTEGER NOT NULL CHECK(home_score BETWEEN 0 AND 15),
 away_score INTEGER NOT NULL CHECK(away_score BETWEEN 0 AND 15),
 fa_home_id INTEGER NOT NULL,
 fa_away_id INTEGER NOT NULL,
 observed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_football_training_date ON football_training_results(match_date);
-- Seed identities from the hand-checked badge matches (source_ref 'sportmonks:team:<id>').
INSERT OR IGNORE INTO fa_team_identity(fa_team_id,sportmonks_team_id,team_name,matched_by,updated_at)
 SELECT fa_team_id,CAST(substr(source_ref,17) AS INTEGER),team_name,'badge_match:'||matched_by,updated_at
 FROM team_badges WHERE source_ref LIKE 'sportmonks:team:%';
