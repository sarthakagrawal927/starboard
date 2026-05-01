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
  is_public   INTEGER NOT NULL DEFAULT 0,
  slug        TEXT,
  description TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_repos (
  user_id     TEXT NOT NULL REFERENCES users(id),
  repo_id     INTEGER NOT NULL REFERENCES repos(id),
  list_id     INTEGER REFERENCES user_lists(id) ON DELETE SET NULL,
  tags        TEXT NOT NULL DEFAULT '[]',
  notes       TEXT,
  is_starred  INTEGER NOT NULL DEFAULT 1,
  is_saved    INTEGER NOT NULL DEFAULT 0,
  starred_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, repo_id)
);

CREATE TABLE IF NOT EXISTS user_repo_lists (
  user_id    TEXT NOT NULL REFERENCES users(id),
  repo_id    INTEGER NOT NULL REFERENCES repos(id),
  list_id    INTEGER NOT NULL REFERENCES user_lists(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, repo_id, list_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id     INTEGER NOT NULL,
  user_id     TEXT NOT NULL REFERENCES users(id),
  body        TEXT NOT NULL,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS likes (
  user_id     TEXT NOT NULL REFERENCES users(id),
  repo_id     INTEGER NOT NULL,
  created_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, repo_id)
);

CREATE TABLE IF NOT EXISTS comment_votes (
  user_id    TEXT NOT NULL REFERENCES users(id),
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  value      INTEGER NOT NULL CHECK(value IN (1, -1)),
  PRIMARY KEY (user_id, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_user_repos_user ON user_repos(user_id);
CREATE INDEX IF NOT EXISTS idx_user_repos_list ON user_repos(user_id, list_id);
CREATE INDEX IF NOT EXISTS idx_user_repo_lists_user_list ON user_repo_lists(user_id, list_id);
CREATE INDEX IF NOT EXISTS idx_user_repo_lists_repo ON user_repo_lists(repo_id);
CREATE INDEX IF NOT EXISTS idx_repos_language ON repos(language);
CREATE INDEX IF NOT EXISTS idx_comments_repo ON comments(repo_id);
CREATE INDEX IF NOT EXISTS idx_likes_repo ON likes(repo_id);
CREATE INDEX IF NOT EXISTS idx_user_lists_slug ON user_lists(slug);
CREATE INDEX IF NOT EXISTS idx_comment_votes_comment ON comment_votes(comment_id);

CREATE TABLE IF NOT EXISTS repo_embeddings (
  repo_id    INTEGER PRIMARY KEY REFERENCES repos(id) ON DELETE CASCADE,
  embedding  F32_BLOB(768),
  text_hash  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_repo_embeddings_vec
  ON repo_embeddings(libsql_vector_idx(embedding, 'metric=cosine'));

-- Cursor for the daily GH Action that seeds popular repos.
-- One row, id=1. Walks GH search top-down by star count, resets when the walk
-- completes so the next run rediscovers newly-eligible repos and refreshes
-- metadata drift on existing rows.
CREATE TABLE IF NOT EXISTS seed_cursor (
  id              INTEGER PRIMARY KEY CHECK(id = 1),
  next_max_stars  INTEGER NOT NULL DEFAULT 999999999,
  next_page       INTEGER NOT NULL DEFAULT 1,
  updated_at      TEXT    DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO seed_cursor (id) VALUES (1);

CREATE INDEX IF NOT EXISTS idx_repos_stars ON repos(stargazers_count DESC);
CREATE INDEX IF NOT EXISTS idx_repos_updated ON repos(repo_updated_at);
