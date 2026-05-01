import type { Client } from "@libsql/client";
import { beforeAll,describe, expect, it } from "vitest";

const hasEnv = !!(process.env.TURSO_DATABASE_URL && process.env.AI_GATEWAY_URL);

describe.skipIf(!hasEnv)("semantic search (integration)", () => {
  let db: Client;

  beforeAll(async () => {
    const { createClient } = await import("@libsql/client");
    db = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  });

  it("has embeddings in the database", async () => {
    const result = await db.execute("SELECT COUNT(*) as c FROM repo_embeddings");
    expect(result.rows[0]?.c as number).toBeGreaterThan(0);
  });

  it("vector_top_k returns only id column (no distance)", async () => {
    const { generateEmbedding } = await import("@/lib/embeddings");
    const embedding = await generateEmbedding("test");
    const result = await db.execute({
      sql: "SELECT * FROM vector_top_k('idx_repo_embeddings_vec', vector(?), 5)",
      args: [JSON.stringify(embedding)],
    });
    expect(result.columns).toEqual(["id"]);
    expect(result.rows.length).toBe(5);
  });

  it("join query returns repo IDs", async () => {
    const { generateEmbedding } = await import("@/lib/embeddings");
    const embedding = await generateEmbedding("test");
    const result = await db.execute({
      sql: `SELECT re.repo_id
            FROM vector_top_k('idx_repo_embeddings_vec', vector(?), 10) AS vt
            JOIN repo_embeddings re ON re.rowid = vt.id`,
      args: [JSON.stringify(embedding)],
    });
    expect(result.rows.length).toBe(10);
    expect(result.rows[0]).toHaveProperty("repo_id");
  });

  it("two-step user-scoped search works (vector then filter)", async () => {
    const { generateEmbedding } = await import("@/lib/embeddings");
    const userResult = await db.execute("SELECT user_id FROM user_repos LIMIT 1");
    if (userResult.rows.length === 0) return;
    const userId = userResult.rows[0]!.user_id as string;

    // Step 1: vector search (no user join — 3-way join deadlocks in Turso)
    const embedding = await generateEmbedding("web framework");
    const vectorResult = await db.execute({
      sql: `SELECT re.repo_id
            FROM vector_top_k('idx_repo_embeddings_vec', vector(?), ?) AS vt
            JOIN repo_embeddings re ON re.rowid = vt.id`,
      args: [JSON.stringify(embedding), 50],
    });
    expect(vectorResult.rows.length).toBeGreaterThan(0);

    // Step 2: filter by user (simulates the main query's WHERE r.id IN (...))
    const repoIds = vectorResult.rows.map((r) => r.repo_id as number);
    const placeholders = repoIds.map(() => "?").join(", ");
    const userResult2 = await db.execute({
      sql: `SELECT r.full_name FROM user_repos ur
            JOIN repos r ON r.id = ur.repo_id
            WHERE ur.user_id = ? AND r.id IN (${placeholders})
            LIMIT 5`,
      args: [userId, ...repoIds],
    });
    expect(userResult2.rows.length).toBeGreaterThan(0);
  });

  describe("semantic relevance", () => {
    const cases = [
      { query: "react framework", expect: ["react"] },
      { query: "machine learning python", expect: ["ml", "learn", "python", "torch", "tensor"] },
      { query: "command line tool", expect: ["cli", "terminal", "command", "shell"] },
      { query: "kubernetes container orchestration", expect: ["kube", "k8s", "container", "docker"] },
      { query: "database SQL", expect: ["sql", "db", "database", "postgres", "sqlite", "turso"] },
    ];

    for (const tc of cases) {
      it(`"${tc.query}" returns relevant repos`, async () => {
        const { generateEmbedding } = await import("@/lib/embeddings");
        const embedding = await generateEmbedding(tc.query);
        const result = await db.execute({
          sql: `SELECT r.full_name, r.description
                FROM vector_top_k('idx_repo_embeddings_vec', vector(?), 10) AS vt
                JOIN repo_embeddings re ON re.rowid = vt.id
                JOIN repos r ON r.id = re.repo_id`,
          args: [JSON.stringify(embedding)],
        });

        const allText = result.rows
          .map((r) => `${r.full_name} ${r.description ?? ""}`.toLowerCase());

        const hasMatch = tc.expect.some((sub) =>
          allText.some((text) => text.includes(sub.toLowerCase()))
        );
        expect(hasMatch).toBe(true);
      });
    }
  });

  describe("similar repos (seeded by repo embedding)", () => {
    it("vector_extract returns JSON-parseable string for stored embedding", async () => {
      const seed = await db.execute(
        "SELECT repo_id, vector_extract(embedding) AS vec FROM repo_embeddings LIMIT 1"
      );
      expect(seed.rows.length).toBe(1);
      const vec = seed.rows[0]!.vec as string;
      expect(typeof vec).toBe("string");
      const parsed = JSON.parse(vec);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(768);
    });

    it("ANN query seeded by stored embedding excludes self and orders by distance", async () => {
      const seed = await db.execute(
        "SELECT repo_id, vector_extract(embedding) AS vec FROM repo_embeddings LIMIT 1"
      );
      const repoId = seed.rows[0]!.repo_id as number;
      const vec = seed.rows[0]!.vec as string;

      const ann = await db.execute({
        sql: `SELECT re.repo_id, vector_distance_cos(re.embedding, vector(?)) AS dist
              FROM vector_top_k('idx_repo_embeddings_vec', vector(?), 20) AS vt
              JOIN repo_embeddings re ON re.rowid = vt.id
              WHERE re.repo_id != ?
              ORDER BY dist ASC`,
        args: [vec, vec, repoId],
      });

      expect(ann.rows.length).toBeGreaterThan(0);
      expect(ann.rows.every((r) => (r.repo_id as number) !== repoId)).toBe(true);

      const dists = ann.rows.map((r) => r.dist as number);
      const sorted = [...dists].sort((a, b) => a - b);
      expect(dists).toEqual(sorted);
    });
  });

  describe("lexical search (NOCASE + expanded columns)", () => {
    it("LIKE COLLATE NOCASE matches across case", async () => {
      const userResult = await db.execute("SELECT user_id FROM user_repos LIMIT 1");
      if (userResult.rows.length === 0) return;
      const userId = userResult.rows[0]!.user_id as string;

      const lower = await db.execute({
        sql: `SELECT COUNT(*) as c FROM user_repos ur JOIN repos r ON r.id = ur.repo_id
              WHERE ur.user_id = ? AND r.name LIKE ? COLLATE NOCASE`,
        args: [userId, "%a%"],
      });
      const upper = await db.execute({
        sql: `SELECT COUNT(*) as c FROM user_repos ur JOIN repos r ON r.id = ur.repo_id
              WHERE ur.user_id = ? AND r.name LIKE ? COLLATE NOCASE`,
        args: [userId, "%A%"],
      });
      expect(lower.rows[0]!.c).toBe(upper.rows[0]!.c);
    });
  });
});
