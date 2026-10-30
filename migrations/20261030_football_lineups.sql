-- Apply to TIKI_DB (tiki_data_lab). Football-API lineups of finished matches already stored in
-- football_training_results, kept so probable XIs keep using recent games after the Sportmonks archive stopped
-- (2026-10-28). Football-API team and player IDs are their own namespace and are never compared with Sportmonks IDs.
CREATE TABLE IF NOT EXISTS football_lineups (
 fa_match_id INTEGER NOT NULL,
 fa_team_id INTEGER NOT NULL,
 match_date TEXT NOT NULL,
 league_key TEXT NOT NULL,
 starters_json TEXT NOT NULL,
 bench_json TEXT NOT NULL,
 observed_at TEXT NOT NULL,
 PRIMARY KEY(fa_match_id,fa_team_id)
);
CREATE INDEX IF NOT EXISTS football_lineups_team_date ON football_lineups(fa_team_id,match_date);
-- One row per attempted match. Empty provider lineups are retried a few times, then left alone.
CREATE TABLE IF NOT EXISTS football_lineup_fetches (
 fa_match_id INTEGER PRIMARY KEY,
 players INTEGER NOT NULL,
 attempts INTEGER NOT NULL,
 last_attempt_at TEXT NOT NULL,
 last_error TEXT
);
