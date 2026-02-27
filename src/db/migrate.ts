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

  // Create new schema
  const schema = readFileSync(join(__dirname, "schema.sql"), "utf-8");
  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await db.execute(statement);
  }

  console.log("Migration complete");
  process.exit(0);
}

migrate().catch(console.error);
