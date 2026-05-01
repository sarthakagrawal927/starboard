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
