-- Team badges stored in TIKI_DB and served by the Worker at /badges/<fa_team_id>.png,
-- so match cards no longer depend on a provider's image CDN.
CREATE TABLE IF NOT EXISTS team_badges (
 fa_team_id INTEGER PRIMARY KEY,
 team_name TEXT NOT NULL,
 country TEXT,
 content_type TEXT NOT NULL CHECK(content_type IN ('image/png','image/jpeg','image/webp')),
 image BLOB NOT NULL,
 image_sha256 TEXT NOT NULL,
 source TEXT NOT NULL,
 source_ref TEXT,
 matched_by TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
