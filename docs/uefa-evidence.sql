-- UEFA verified historical fixture evidence. Derived normalized metrics only; no raw API blobs.
CREATE TABLE IF NOT EXISTS uefa_match_evidence (
 fixture_id INTEGER PRIMARY KEY,
 league_key TEXT NOT NULL CHECK(league_key IN ('ucl','uel','uecl')),
 match_date TEXT NOT NULL,
 home_team_id INTEGER NOT NULL,away_team_id INTEGER NOT NULL,
 home_team TEXT NOT NULL,away_team TEXT NOT NULL,
 home_score INTEGER NOT NULL CHECK(home_score BETWEEN 0 AND 15),
 away_score INTEGER NOT NULL CHECK(away_score BETWEEN 0 AND 15),
 home_xg REAL,away_xg REAL,home_shots INTEGER,away_shots INTEGER,
 home_shots_on_target INTEGER,away_shots_on_target INTEGER,
 home_possession REAL,away_possession REAL,
 metric_coverage TEXT NOT NULL,observed_at TEXT NOT NULL,
 source TEXT NOT NULL DEFAULT 'sportmonks_final'
);
CREATE INDEX IF NOT EXISTS idx_uefa_evidence_league_date ON uefa_match_evidence(league_key,match_date DESC);
CREATE INDEX IF NOT EXISTS idx_uefa_evidence_teams ON uefa_match_evidence(home_team_id,away_team_id,match_date DESC);
