-- Apply only to the separate SPORTMONKS_RAW_* databases, never the public model database.
CREATE TABLE IF NOT EXISTS archive_pages(
 task TEXT NOT NULL,page INTEGER NOT NULL,request_path TEXT NOT NULL,params_json TEXT NOT NULL,
 payload_gzip BLOB NOT NULL,sha256 TEXT NOT NULL,records INTEGER NOT NULL,raw_bytes INTEGER NOT NULL,
 gzip_bytes INTEGER NOT NULL,fetched_at TEXT NOT NULL,PRIMARY KEY(task,page)
);
CREATE TABLE IF NOT EXISTS archive_tasks(
 task TEXT PRIMARY KEY,path TEXT NOT NULL,params_json TEXT NOT NULL,priority INTEGER NOT NULL DEFAULT 100,page INTEGER NOT NULL DEFAULT 1,
 status TEXT NOT NULL DEFAULT 'pending',records INTEGER NOT NULL DEFAULT 0,pages INTEGER NOT NULL DEFAULT 0,
 gzip_bytes INTEGER NOT NULL DEFAULT 0,last_error TEXT,updated_at TEXT,lease_until INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS archive_state(key TEXT PRIMARY KEY,value TEXT NOT NULL);

CREATE INDEX IF NOT EXISTS archive_task_priority ON archive_tasks(status,priority,task);
CREATE INDEX IF NOT EXISTS archive_task_lease ON archive_tasks(status,lease_until);
