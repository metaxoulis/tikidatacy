-- SportAPI.ai logo metadata only: provider reference, not claimed image ownership.
CREATE TABLE IF NOT EXISTS sportapi_team_assets (
  provider_team_id TEXT PRIMARY KEY,
  team_name TEXT NOT NULL,
  logo_endpoint TEXT NOT NULL,
  observed_league_id TEXT,
  observed_at TEXT NOT NULL,
  logo_status TEXT NOT NULL DEFAULT 'unverified',
  license_note TEXT NOT NULL DEFAULT 'SportAPI.ai asset; third-party trademark and redistribution rights must be checked'
);
CREATE TABLE IF NOT EXISTS sportapi_league_assets (
  provider_league_id TEXT PRIMARY KEY,
  league_name TEXT NOT NULL,
  country_geo TEXT,
  logo_endpoint TEXT,
  observed_at TEXT NOT NULL,
  logo_status TEXT NOT NULL DEFAULT 'provider_logo_not_documented',
  license_note TEXT NOT NULL DEFAULT 'League crest not available from documented SportAPI.ai endpoints'
);
CREATE INDEX IF NOT EXISTS idx_sportapi_team_assets_league ON sportapi_team_assets(observed_league_id);
