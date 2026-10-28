-- Competition logos (emblem on a white disc) stored in TIKI_DB and served by the Worker at
-- /league-logos/<league_key>.png. Cups without a known Football-API ID use "name-<country>-<competition>".
CREATE TABLE IF NOT EXISTS league_logos (
 league_key TEXT PRIMARY KEY CHECK(league_key GLOB '[a-z0-9]*' AND league_key NOT GLOB '*[^a-z0-9-]*'),
 name TEXT NOT NULL,
 content_type TEXT NOT NULL CHECK(content_type IN ('image/png','image/jpeg','image/webp')),
 image BLOB NOT NULL,
 image_sha256 TEXT NOT NULL,
 source TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
