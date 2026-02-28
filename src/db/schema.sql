CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  username    TEXT NOT NULL,
  avatar_url  TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS repos (
  id               INTEGER PRIMARY KEY,
  name             TEXT NOT NULL,
  full_name        TEXT NOT NULL,
  owner_login      TEXT NOT NULL,
  owner_avatar     TEXT NOT NULL,
  html_url         TEXT NOT NULL,
  description      TEXT,
  language         TEXT,
  stargazers_count INTEGER NOT NULL DEFAULT 0,
  topics           TEXT NOT NULL DEFAULT '[]',
  repo_created_at  TEXT,
  repo_updated_at  TEXT
);

CREATE TABLE IF NOT EXISTS user_lists (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users(id),
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#6366f1',
  icon        TEXT,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_repos (
  user_id     TEXT NOT NULL REFERENCES users(id),
  repo_id     INTEGER NOT NULL REFERENCES repos(id),
  list_id     INTEGER REFERENCES user_lists(id) ON DELETE SET NULL,
  tags        TEXT NOT NULL DEFAULT '[]',
  notes       TEXT,
  starred_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, repo_id)
);

CREATE INDEX IF NOT EXISTS idx_user_repos_user ON user_repos(user_id);
CREATE INDEX IF NOT EXISTS idx_user_repos_list ON user_repos(user_id, list_id);
CREATE INDEX IF NOT EXISTS idx_repos_language ON repos(language);
