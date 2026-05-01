import type { InStatement } from "@libsql/client";
import { createClient } from "@libsql/client";

import {
  buildRepoEmbeddingText,
  generateEmbeddings,
  textHash,
} from "../lib/embeddings";

const BATCH_SIZE = 50;

async function seed() {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const existing = await db.execute(
    "SELECT repo_id, text_hash FROM repo_embeddings"
  );
  const existingHashes = new Map(
    existing.rows.map((r) => [r.repo_id as number, r.text_hash as string])
  );

  const repos = await db.execute(
    "SELECT id, full_name, description, language, topics FROM repos"
  );

  const toEmbed: { id: number; text: string; hash: string }[] = [];
  for (const row of repos.rows) {
    const text = buildRepoEmbeddingText({
      full_name: row.full_name as string,
      description: row.description as string | null,
      language: row.language as string | null,
      topics: row.topics as string,
    });
    const hash = textHash(text);
    if (existingHashes.get(row.id as number) !== hash) {
      toEmbed.push({ id: row.id as number, text, hash });
    }
  }

  console.log(
    `${repos.rows.length} repos total, ${toEmbed.length} need embedding`
  );

  if (toEmbed.length === 0) {
    console.log("Nothing to do");
    process.exit(0);
  }

  for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
    const batch = toEmbed.slice(i, i + BATCH_SIZE);
    const texts = batch.map((r) => r.text);

    console.log(
      `Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(toEmbed.length / BATCH_SIZE)} (${batch.length} repos)...`
    );

    const embeddings = await generateEmbeddings(texts);

    const stmts: InStatement[] = batch.map((item, j) => ({
      sql: "INSERT OR REPLACE INTO repo_embeddings (repo_id, embedding, text_hash) VALUES (?, vector(?), ?)",
      args: [item.id, JSON.stringify(embeddings[j]), item.hash],
    }));

    await db.batch(stmts);
  }

  const count = await db.execute("SELECT COUNT(*) as c FROM repo_embeddings");
  console.log(`Done. ${count.rows[0]?.c} repos now have embeddings.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
