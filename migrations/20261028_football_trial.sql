CREATE TABLE IF NOT EXISTS football_trial_cache (
 cache_key TEXT PRIMARY KEY, payload_json TEXT, fetched_at INTEGER NOT NULL DEFAULT 0,
 lease_until INTEGER NOT NULL DEFAULT 0, retry_after INTEGER NOT NULL DEFAULT 0, last_error TEXT
);
CREATE TABLE IF NOT EXISTS football_trial_usage (
 day_utc TEXT PRIMARY KEY, used INTEGER NOT NULL DEFAULT 0 CHECK(used>=0)
);
CREATE TABLE IF NOT EXISTS football_trial_matches (
 match_id INTEGER PRIMARY KEY, payload_json TEXT NOT NULL, observed_at TEXT NOT NULL, finished INTEGER NOT NULL
);
