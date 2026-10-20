-- Existing scores remain intact; legacy names are bridged only when unambiguous.
ALTER TABLE sportmonks_training_results ADD COLUMN home_team_id INTEGER;
ALTER TABLE sportmonks_training_results ADD COLUMN away_team_id INTEGER;
CREATE INDEX IF NOT EXISTS sportmonks_training_home_id ON sportmonks_training_results(home_team_id,match_date);
CREATE INDEX IF NOT EXISTS sportmonks_training_away_id ON sportmonks_training_results(away_team_id,match_date);
