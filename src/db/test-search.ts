import { createClient } from "@libsql/client";
import { generateEmbedding } from "../lib/embeddings";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

interface TestCase {
  query: string;
  expectSubstrings: string[]; // at least one repo full_name should contain one of these
}

const tests: TestCase[] = [
  { query: "react framework", expectSubstrings: ["react"] },
  { query: "machine learning python", expectSubstrings: ["ml", "learn", "python", "torch", "tensor"] },
  { query: "command line tool", expectSubstrings: ["cli", "terminal", "command", "shell"] },
  { query: "kubernetes container orchestration", expectSubstrings: ["kube", "k8s", "container", "docker"] },
  { query: "database SQL", expectSubstrings: ["sql", "db", "database", "postgres", "sqlite", "turso"] },
];

async function runTests() {
  // 1. Verify embeddings exist
  const countResult = await db.execute("SELECT COUNT(*) as c FROM repo_embeddings");
  const count = countResult.rows[0]?.c as number;
  console.log(`\n  Embeddings in DB: ${count}`);
  if (count === 0) {
    console.error("  FAIL: No embeddings found");
    process.exit(1);
  }
  console.log("  PASS: Embeddings exist\n");

  // 2. Verify vector_top_k returns results (no distance column)
  const testEmbedding = await generateEmbedding("test");
  const vtResult = await db.execute({
    sql: "SELECT * FROM vector_top_k('idx_repo_embeddings_vec', vector(?), 5)",
    args: [JSON.stringify(testEmbedding)],
  });
  console.log(`  vector_top_k columns: ${vtResult.columns.join(", ")}`);
  console.log(`  vector_top_k returned ${vtResult.rows.length} rows`);
  if (vtResult.rows.length === 0) {
    console.error("  FAIL: vector_top_k returned no results");
    process.exit(1);
  }
  console.log("  PASS: vector_top_k works\n");

  // 3. Verify the full join query (matching what the API uses)
  const joinResult = await db.execute({
    sql: `SELECT re.repo_id
          FROM vector_top_k('idx_repo_embeddings_vec', vector(?), 10) AS vt
          JOIN repo_embeddings re ON re.rowid = vt.id`,
    args: [JSON.stringify(testEmbedding)],
  });
  console.log(`  Join query returned ${joinResult.rows.length} repo IDs`);
  if (joinResult.rows.length === 0) {
    console.error("  FAIL: Join query returned no results");
    process.exit(1);
  }
  console.log("  PASS: Join query works\n");

  // 4. Semantic relevance tests
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const embedding = await generateEmbedding(test.query);
    const result = await db.execute({
      sql: `SELECT r.full_name, r.description
            FROM vector_top_k('idx_repo_embeddings_vec', vector(?), 10) AS vt
            JOIN repo_embeddings re ON re.rowid = vt.id
            JOIN repos r ON r.id = re.repo_id`,
      args: [JSON.stringify(embedding)],
    });

    const names = result.rows.map((r) => (r.full_name as string).toLowerCase());
    const descriptions = result.rows.map((r) => ((r.description as string) ?? "").toLowerCase());
    const allText = names.concat(descriptions);

    const hasMatch = test.expectSubstrings.some((sub) =>
      allText.some((text) => text.includes(sub.toLowerCase()))
    );

    if (hasMatch) {
      console.log(`  PASS: "${test.query}" → ${names.slice(0, 3).join(", ")}...`);
      passed++;
    } else {
      console.error(`  FAIL: "${test.query}" — no results matched [${test.expectSubstrings.join(", ")}]`);
      console.error(`    Got: ${names.join(", ")}`);
      failed++;
    }
  }

  console.log(`\n  Results: ${passed} passed, ${failed} failed out of ${tests.length} tests`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
