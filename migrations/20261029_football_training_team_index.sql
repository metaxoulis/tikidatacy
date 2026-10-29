-- Per-team lookups for match-page history and season form (same indexes as sportmonks_training_results).
CREATE INDEX IF NOT EXISTS football_training_home_id ON football_training_results(home_team_id,match_date);
CREATE INDEX IF NOT EXISTS football_training_away_id ON football_training_results(away_team_id,match_date);
