import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  buildRepoEmbeddingText,
  textHash,
  generateEmbeddings,
} from "@/lib/embeddings";
import { NextResponse } from "next/server";
import type { InStatement } from "@libsql/client";

export async function POST() {
  const session = await auth();
  if (!session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.githubId;

  try {
    const result = await db.execute({
      sql: `SELECT r.id, r.full_name, r.description, r.language, r.topics, re.text_hash
            FROM user_repos ur
            JOIN repos r ON r.id = ur.repo_id
            LEFT JOIN repo_embeddings re ON re.repo_id = r.id
            WHERE ur.user_id = ?`,
      args: [userId],
    });

    const toEmbed: { repoId: number; text: string; hash: string }[] = [];

    for (const row of result.rows) {
      const text = buildRepoEmbeddingText({
        full_name: row.full_name as string,
        description: row.description as string | null,
        language: row.language as string | null,
        topics: row.topics as string,
      });
      const hash = textHash(text);

      if (row.text_hash !== hash) {
        toEmbed.push({ repoId: row.id as number, text, hash });
      }
    }

    if (toEmbed.length > 0) {
      const embeddings = await generateEmbeddings(toEmbed.map((r) => r.text));

      const statements: InStatement[] = toEmbed.map((item, i) => ({
        sql: `INSERT INTO repo_embeddings (repo_id, embedding, text_hash)
              VALUES (?, vector(?), ?)
              ON CONFLICT(repo_id) DO UPDATE SET
                embedding = excluded.embedding,
                text_hash = excluded.text_hash`,
        args: [item.repoId, JSON.stringify(embeddings[i]), item.hash],
      }));

      await db.batch(statements);
    }

    return NextResponse.json({
      embedded: toEmbed.length,
      total: result.rows.length,
    });
  } catch (error) {
    console.error("Embedding generation failed:", error);
    return NextResponse.json(
      { error: "Embedding generation failed" },
      { status: 500 }
    );
  }
}
