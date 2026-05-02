/**
 * Opt-in AI taxonomy enrichment for repo discovery.
 *
 * This is deliberately separate from the daily seed path and capped by default.
 * It uses the same AI Gateway/free-AI path as embeddings, but only when invoked.
 *
 * Required env:
 *   TURSO_DATABASE_URL
 *   TURSO_AUTH_TOKEN
 *   AI_GATEWAY_URL
 *   AI_GATEWAY_API_KEY
 * Optional env:
 *   ENRICH_LIMIT          — repos to enrich this run, default 50
 *   ENRICH_HARD_LIMIT     — safety cap for one run, default 200
 *   MIN_STARS_FLOOR      — minimum stars to enrich, default 5000
 *   AI_GATEWAY_REASONING_EFFORT     — free-AI router effort, default medium
 *   AI_GATEWAY_MIN_REASONING_LEVEL  — free-AI minimum model level, default medium
 */

import { type Client, createClient, type InStatement } from "@libsql/client";

import {
  generateRepoAiMetadata,
  HEURISTIC_REPO_AI_METADATA_MODEL,
  inferRepoAiMetadata,
  REPO_AI_METADATA_ROUTE,
  type RepoAiMetadata,
  repoAiSourceHash,
  type RepoMetadataSource,
} from "../src/lib/repo-ai-metadata";

const REQUESTED_LIMIT = parseInt(process.env.ENRICH_LIMIT || "50", 10);
const HARD_LIMIT = parseInt(process.env.ENRICH_HARD_LIMIT || "200", 10);
const LIMIT = Math.min(Math.max(REQUESTED_LIMIT || 0, 0), HARD_LIMIT);
const MIN_STARS_FLOOR = parseInt(process.env.MIN_STARS_FLOOR || "5000", 10);
const DELAY_MS = parseInt(process.env.ENRICH_DELAY_MS || "500", 10);
const ALLOW_HEURISTIC_FALLBACK =
  process.env.ENRICH_ALLOW_HEURISTIC_FALLBACK !== "0";

interface PendingRepo extends RepoMetadataSource {
  id: number;
  stargazers_count: number;
  existing_source_hash: string | null;
}

async function loadPending(db: Client, limit: number): Promise<PendingRepo[]> {
  const result = await db.execute({
    sql: `SELECT r.id,
                 r.full_name,
                 r.description,
                 r.language,
                 r.topics,
                 r.stargazers_count,
                 ram.source_hash AS existing_source_hash
          FROM repos r
          LEFT JOIN repo_ai_metadata ram ON ram.repo_id = r.id
          WHERE r.stargazers_count >= ?
          ORDER BY
            CASE WHEN ram.repo_id IS NULL THEN 0 ELSE 1 END ASC,
            r.stargazers_count DESC
          LIMIT ?`,
    args: [MIN_STARS_FLOOR, limit * 4],
  });

  const pending: PendingRepo[] = [];
  for (const row of result.rows) {
    const repo = {
      id: row.id as number,
      full_name: row.full_name as string,
      description: row.description as string | null,
      language: row.language as string | null,
      topics: row.topics as string,
      stargazers_count: row.stargazers_count as number,
      existing_source_hash: row.existing_source_hash as string | null,
    };
    if (repo.existing_source_hash !== repoAiSourceHash(repo)) {
      pending.push(repo);
    }
    if (pending.length >= limit) break;
  }
  return pending;
}

async function upsertMetadata(db: Client, repo: PendingRepo) {
  const { metadata, model } = await generateMetadataSafely(repo);
  const stmt: InStatement = {
    sql: `INSERT INTO repo_ai_metadata
            (repo_id, summary, category, subcategories, use_cases, keywords, source_hash, model)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(repo_id) DO UPDATE SET
            summary = excluded.summary,
            category = excluded.category,
            subcategories = excluded.subcategories,
            use_cases = excluded.use_cases,
            keywords = excluded.keywords,
            source_hash = excluded.source_hash,
            model = excluded.model,
            updated_at = datetime('now')`,
    args: [
      repo.id,
      metadata.summary,
      metadata.category,
      JSON.stringify(metadata.subcategories),
      JSON.stringify(metadata.use_cases),
      JSON.stringify(metadata.keywords),
      repoAiSourceHash(repo),
      model,
    ],
  };
  await db.execute(stmt);
}

async function generateMetadataSafely(
  repo: PendingRepo
): Promise<{ metadata: RepoAiMetadata; model: string }> {
  try {
    return generateRepoAiMetadata(repo);
  } catch (error) {
    if (!ALLOW_HEURISTIC_FALLBACK) throw error;
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[enrich] AI metadata failed for ${repo.full_name}; using heuristic fallback: ${message}`
    );
    return {
      metadata: inferRepoAiMetadata(repo),
      model: HEURISTIC_REPO_AI_METADATA_MODEL,
    };
  }
}

async function main() {
  if (LIMIT <= 0) {
    console.info("[enrich] ENRICH_LIMIT is 0; nothing to do");
    return;
  }

  const db = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  console.info(
    `[enrich] route=${REPO_AI_METADATA_ROUTE} limit=${LIMIT} hard_limit=${HARD_LIMIT} min_stars=${MIN_STARS_FLOOR} heuristic_fallback=${ALLOW_HEURISTIC_FALLBACK}`
  );
  const pending = await loadPending(db, LIMIT);
  console.info(`[enrich] ${pending.length} repos need AI metadata`);

  for (let i = 0; i < pending.length; i++) {
    const repo = pending[i]!;
    console.info(
      `[enrich] ${i + 1}/${pending.length} ${repo.full_name} (${repo.stargazers_count} stars)`
    );
    await upsertMetadata(db, repo);
    if (DELAY_MS > 0 && i < pending.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  const totals = await db.execute(
    `SELECT
       (SELECT COUNT(*) FROM repos WHERE stargazers_count >= ${MIN_STARS_FLOOR}) AS repos_in_pool,
       (SELECT COUNT(*) FROM repo_ai_metadata ram
          JOIN repos r ON r.id = ram.repo_id
          WHERE r.stargazers_count >= ${MIN_STARS_FLOOR}) AS enriched_in_pool`
  );
  const row = totals.rows[0]!;
  console.info(
    `[done] pool >=${MIN_STARS_FLOOR} stars: ${row.enriched_in_pool}/${row.repos_in_pool} enriched`
  );
}

main().catch((err) => {
  console.error("Enrichment failed:", err);
  process.exit(1);
});
