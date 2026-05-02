import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { join } from "path";

async function migrate() {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  // Drop old tables
  await db.execute("DROP TABLE IF EXISTS repo_tags");
  await db.execute("DROP TABLE IF EXISTS tags");
  await db.execute("DROP TABLE IF EXISTS stars_cache");
  await db.execute("DROP TABLE IF EXISTS collection_repos");
  await db.execute("DROP TABLE IF EXISTS collections");

  // Add new columns to user_lists (idempotent)
  const alters = [
    "ALTER TABLE user_lists ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE user_lists ADD COLUMN slug TEXT",
    "ALTER TABLE user_lists ADD COLUMN description TEXT",
    "ALTER TABLE user_repos ADD COLUMN is_starred INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE user_repos ADD COLUMN is_saved INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE repos ADD COLUMN archived INTEGER NOT NULL DEFAULT 0",
  ];
  for (const sql of alters) {
    try { await db.execute(sql); } catch { /* column already exists */ }
  }

  // Create new schema
  const schema = readFileSync(join(__dirname, "schema.sql"), "utf-8");
  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await db.execute(statement);
  }

  await db.execute(`
    CREATE TRIGGER IF NOT EXISTS repos_ai AFTER INSERT ON repos BEGIN
      INSERT INTO repos_fts(rowid, name, full_name, description, language, topics)
      VALUES (new.id, new.name, new.full_name, new.description, new.language, new.topics);
    END;
  `);
  await db.execute(`
    CREATE TRIGGER IF NOT EXISTS repos_ad AFTER DELETE ON repos BEGIN
      INSERT INTO repos_fts(repos_fts, rowid, name, full_name, description, language, topics)
      VALUES('delete', old.id, old.name, old.full_name, old.description, old.language, old.topics);
    END;
  `);
  await db.execute(`
    CREATE TRIGGER IF NOT EXISTS repos_au AFTER UPDATE ON repos BEGIN
      INSERT INTO repos_fts(repos_fts, rowid, name, full_name, description, language, topics)
      VALUES('delete', old.id, old.name, old.full_name, old.description, old.language, old.topics);
      INSERT INTO repos_fts(rowid, name, full_name, description, language, topics)
      VALUES (new.id, new.name, new.full_name, new.description, new.language, new.topics);
    END;
  `);
  await db.execute("INSERT INTO repos_fts(repos_fts) VALUES('rebuild')");

  await db.execute(`
    CREATE TRIGGER IF NOT EXISTS repo_ai_metadata_ai AFTER INSERT ON repo_ai_metadata BEGIN
      INSERT INTO repo_ai_metadata_fts(rowid, summary, category, subcategories, use_cases, keywords)
      VALUES (
        new.repo_id,
        new.summary,
        new.category,
        new.subcategories,
        new.use_cases,
        new.keywords
      );
    END;
  `);
  await db.execute(`
    CREATE TRIGGER IF NOT EXISTS repo_ai_metadata_ad AFTER DELETE ON repo_ai_metadata BEGIN
      INSERT INTO repo_ai_metadata_fts(repo_ai_metadata_fts, rowid, summary, category, subcategories, use_cases, keywords)
      VALUES(
        'delete',
        old.repo_id,
        old.summary,
        old.category,
        old.subcategories,
        old.use_cases,
        old.keywords
      );
    END;
  `);
  await db.execute(`
    CREATE TRIGGER IF NOT EXISTS repo_ai_metadata_au AFTER UPDATE ON repo_ai_metadata BEGIN
      INSERT INTO repo_ai_metadata_fts(repo_ai_metadata_fts, rowid, summary, category, subcategories, use_cases, keywords)
      VALUES(
        'delete',
        old.repo_id,
        old.summary,
        old.category,
        old.subcategories,
        old.use_cases,
        old.keywords
      );
      INSERT INTO repo_ai_metadata_fts(rowid, summary, category, subcategories, use_cases, keywords)
      VALUES (
        new.repo_id,
        new.summary,
        new.category,
        new.subcategories,
        new.use_cases,
        new.keywords
      );
    END;
  `);
  await db.execute("INSERT INTO repo_ai_metadata_fts(repo_ai_metadata_fts) VALUES('rebuild')");

  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_repo_lists (
      user_id    TEXT NOT NULL REFERENCES users(id),
      repo_id    INTEGER NOT NULL REFERENCES repos(id),
      list_id    INTEGER NOT NULL REFERENCES user_lists(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, repo_id, list_id)
    )
  `);
  await db.execute("CREATE INDEX IF NOT EXISTS idx_user_repo_lists_user_list ON user_repo_lists(user_id, list_id)");
  await db.execute("CREATE INDEX IF NOT EXISTS idx_user_repo_lists_repo ON user_repo_lists(repo_id)");

  await db.execute(`
    INSERT OR IGNORE INTO user_repo_lists (user_id, repo_id, list_id)
    SELECT user_id, repo_id, list_id
    FROM user_repos
    WHERE list_id IS NOT NULL
  `);

  await db.execute(`
    INSERT INTO user_lists (user_id, name, color, icon, position, description)
    SELECT tag_rows.user_id,
           tag_rows.tag,
           '#64748b',
           NULL,
           COALESCE((SELECT MAX(position) FROM user_lists existing WHERE existing.user_id = tag_rows.user_id), -1)
             + ROW_NUMBER() OVER (PARTITION BY tag_rows.user_id ORDER BY lower(tag_rows.tag)),
           'Migrated from tags'
    FROM (
      SELECT DISTINCT ur.user_id, trim(tag_each.value) AS tag
      FROM user_repos ur
      JOIN json_each(ur.tags) AS tag_each
      WHERE ur.tags != '[]'
        AND trim(tag_each.value) != ''
    ) tag_rows
    WHERE NOT EXISTS (
      SELECT 1
      FROM user_lists ul
      WHERE ul.user_id = tag_rows.user_id
        AND lower(ul.name) = lower(tag_rows.tag)
    )
  `);

  await db.execute(`
    INSERT OR IGNORE INTO user_repo_lists (user_id, repo_id, list_id)
    SELECT ur.user_id, ur.repo_id, ul.id
    FROM user_repos ur
    JOIN json_each(ur.tags) AS tag_each
    JOIN user_lists ul
      ON ul.user_id = ur.user_id
     AND lower(ul.name) = lower(trim(tag_each.value))
    WHERE ur.tags != '[]'
      AND trim(tag_each.value) != ''
  `);

  await db.execute(
    "UPDATE user_repos SET is_saved = 1 WHERE list_id IS NOT NULL OR tags != '[]' OR notes IS NOT NULL"
  );

  console.info("Migration complete");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
