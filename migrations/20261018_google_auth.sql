-- Tiki-Data Lab / Google Sign-In. All timestamps are Unix seconds (UTC).
-- Never store OAuth access tokens, ID tokens, or plaintext session cookies.
CREATE TABLE IF NOT EXISTS td_auth_users (
 user_id TEXT PRIMARY KEY,
 google_sub TEXT NOT NULL UNIQUE,
 email TEXT NOT NULL,
 display_name TEXT NOT NULL DEFAULT '',
 avatar_url TEXT,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS td_auth_login_states (
 state_hash TEXT PRIMARY KEY,
 verifier TEXT NOT NULL,
 nonce TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_td_auth_states_expiry ON td_auth_login_states(expires_at);
CREATE TABLE IF NOT EXISTS td_auth_sessions (
 session_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES td_auth_users(user_id) ON DELETE CASCADE,
 csrf_token TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_td_auth_sessions_user ON td_auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_td_auth_sessions_expiry ON td_auth_sessions(expires_at);
CREATE TABLE IF NOT EXISTS td_user_preferences (
 user_id TEXT PRIMARY KEY REFERENCES td_auth_users(user_id) ON DELETE CASCADE,
 teams_json TEXT NOT NULL DEFAULT '[]',
 leagues_json TEXT NOT NULL DEFAULT '[]',
 language TEXT NOT NULL DEFAULT 'el',
 updated_at INTEGER NOT NULL
);