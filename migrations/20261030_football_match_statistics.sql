-- Apply to TIKI_DB (tiki_data_lab). Football-API statistics of finished matches already stored in
-- football_training_results (shots, corners, cards, possession and, where the provider has it, xG), kept so team form
-- stays current after the Sportmonks archive (2026-10-28). stats_json maps the provider's type code to [home, away],
-- codes as sent, including its spellings 'possesion' and 'fauls'. Football-API IDs are their own namespace.
CREATE TABLE IF NOT EXISTS football_match_statistics (
 fa_match_id INTEGER PRIMARY KEY,
 match_date TEXT NOT NULL,
 league_key TEXT NOT NULL,
 fa_home_id INTEGER NOT NULL,
 fa_away_id INTEGER NOT NULL,
 home_xg REAL,
 away_xg REAL,
 stats_json TEXT NOT NULL,
 observed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS football_match_statistics_home_date ON football_match_statistics(fa_home_id,match_date);
CREATE INDEX IF NOT EXISTS football_match_statistics_away_date ON football_match_statistics(fa_away_id,match_date);
-- One row per attempted match. Empty provider answers are retried a few times, then left alone.
CREATE TABLE IF NOT EXISTS football_statistics_fetches (
 fa_match_id INTEGER PRIMARY KEY,
 metrics INTEGER NOT NULL,
 attempts INTEGER NOT NULL,
 last_attempt_at TEXT NOT NULL,
 last_error TEXT
);
