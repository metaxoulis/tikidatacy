-- Persist only trained parameters derived from CC0 OpenFootball finished results.
-- No unlicensed raw SportAPI.ai or AllSportsAPI payload is inserted.
CREATE TABLE IF NOT EXISTS focus_model_snapshots (
 model_key TEXT PRIMARY KEY,
 payload_json TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 trained_at TEXT NOT NULL
);
