CREATE TABLE IF NOT EXISTS ml_calibration_candidates (
 base_model TEXT PRIMARY KEY,
 payload_json TEXT NOT NULL,
 trained_at TEXT NOT NULL
);
