/**
 * Daily seed/refresh of popular GitHub repos into our `repos` + `repo_embeddings` tables.
 *
 * Each run:
 *   1. Walk GH search across all `stars >= MIN_STARS_FLOOR` buckets, upsert every repo.
 *      Discovers new ≥5k repos AND refreshes stale metadata in one pass. Cursor resumes
 *      mid-walk after a crash; resets when the walk completes.
 *   2. Embed up to SEED_DAILY_LIMIT pending repos (missing embedding OR drifted text_hash),
 *      ordered by star count desc.
 *
 * GH metadata walking is free under quota (~120 calls / 5000-per-hour). Bottleneck is
 * the daily embed budget (CF Workers AI). After ~12 catch-up days the pool is fully
 * embedded; subsequent runs pick up only newly-eligible repos and metadata drift.
 *
 * Required env:
 *   TURSO_DATABASE_URL
 *   TURSO_AUTH_TOKEN
 *   AI_GATEWAY_URL
 *   AI_GATEWAY_API_KEY
 *   GITHUB_TOKEN          — fine-grained PAT, public_repo:read
 * Optional env:
 *   SEED_DAILY_LIMIT      — embeddings per run, default 1000
 *   MIN_STARS_FLOOR       — minimum stars to seed, default 5000
 *   STAR_THRESHOLDS       — comma-separated digest thresholds, default 5000,10000,20000,50000,100000
 */

import { type Client, createClient, type InStatement } from "@libsql/client";

import {
  buildRepoEmbeddingText,
  generateEmbeddings,
  textHash,
} from "../src/lib/embeddings";

const DAILY_LIMIT = parseInt(process.env.SEED_DAILY_LIMIT || "1000", 10);
const MIN_STARS_FLOOR = parseInt(process.env.MIN_STARS_FLOOR || "5000", 10);
const STAR_THRESHOLDS = (process.env.STAR_THRESHOLDS || "5000,10000,20000,50000,100000")
  .split(",")
  .map((value) => parseInt(value.trim(), 10))
  .filter((value) => Number.isFinite(value) && value >= MIN_STARS_FLOOR)
  .sort((a, b) => a - b);
const PER_PAGE = 100;
const MAX_PAGES_PER_BUCKET = 10; // GH search caps at 1000 results
const BATCH_SIZE = 50;
const DB_MAX_ATTEMPTS = 4;
const DB_RETRY_BASE_MS = 1_000;

interface GhRepo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string; avatar_url: string };
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  topics: string[] | null;
  created_at: string;
  updated_at: string;
}

interface GhSearchResponse {
  total_count: number;
  items: GhRepo[];
}

function isRetryableDbError(err: unknown): boolean {
  const cause = (err as { cause?: { code?: string } })?.cause;
  const message = err instanceof Error ? err.message : String(err);
  return (
    cause?.code === "UND_ERR_CONNECT_TIMEOUT" ||
    message.includes("fetch failed") ||
    message.includes("Connect Timeout") ||
    message.includes("ECONNRESET") ||
    message.includes("ETIMEDOUT")
  );
}

async function withDbRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= DB_MAX_ATTEMPTS || !isRetryableDbError(err)) {
        throw err;
      }
      const waitMs = DB_RETRY_BASE_MS * 2 ** (attempt - 1);
      console.warn(
        `[db] ${label} failed on attempt ${attempt}; retrying in ${waitMs}ms`
      );
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
}

function executeDb(db: Client, stmt: InStatement | string) {
  return withDbRetry("execute", () => db.execute(stmt));
}

function batchDb(db: Client, stmts: InStatement[]) {
  return withDbRetry("batch", () => db.batch(stmts));
}

async function loadPreviousStarCounts(
  db: Client,
  repoIds: number[]
): Promise<Map<number, number>> {
  if (repoIds.length === 0) return new Map();

  const result = await executeDb(db, {
    sql: `SELECT id, stargazers_count FROM repos WHERE id IN (${repoIds
      .map(() => "?")
      .join(", ")})`,
    args: repoIds,
  });

  return new Map(
    result.rows.map((row) => [
      row.id as number,
      row.stargazers_count as number,
    ])
  );
}

function buildThresholdEventStatements(
  repos: GhRepo[],
  previousStarCounts: Map<number, number>
): InStatement[] {
  const stmts: InStatement[] = [];

  for (const repo of repos) {
    const previousStars = previousStarCounts.get(repo.id);

    for (const threshold of STAR_THRESHOLDS) {
      const crossed =
        previousStars === undefined
          ? threshold === MIN_STARS_FLOOR && repo.stargazers_count >= threshold
          : previousStars < threshold && repo.stargazers_count >= threshold;

      if (!crossed) continue;

      stmts.push({
        sql: `INSERT OR IGNORE INTO repo_threshold_events
              (repo_id, threshold, previous_stars, current_stars)
              VALUES (?, ?, ?, ?)`,
        args: [
          repo.id,
          threshold,
          previousStars ?? null,
          repo.stargazers_count,
        ],
      });
    }
  }

  return stmts;
}

async function ghSearch(
  q: string,
  page: number,
  token: string
): Promise<GhSearchResponse> {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${PER_PAGE}&page=${page}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "starboard-seed-bot",
    },
  });
  if (res.status === 403 || res.status === 429) {
    const reset = res.headers.get("x-ratelimit-reset");
    const waitMs = reset ? parseInt(reset, 10) * 1000 - Date.now() : 60_000;
    console.warn(`Rate limited. Sleeping ${Math.round(waitMs / 1000)}s...`);
    await new Promise((r) => setTimeout(r, Math.max(waitMs, 1000)));
    return ghSearch(q, page, token);
  }
  if (!res.ok) {
    throw new Error(`GH search failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function upsertRepos(db: Client, repos: GhRepo[]): Promise<number[]> {
  if (repos.length === 0) return [];
  const previousStarCounts = await loadPreviousStarCounts(
    db,
    repos.map((repo) => repo.id)
  );
  const stmts: InStatement[] = repos.map((r) => ({
    sql: `INSERT INTO repos (id, name, full_name, owner_login, owner_avatar, html_url,
            description, language, stargazers_count, topics, repo_created_at, repo_updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            full_name = excluded.full_name,
            owner_login = excluded.owner_login,
            owner_avatar = excluded.owner_avatar,
            html_url = excluded.html_url,
            description = excluded.description,
            language = excluded.language,
            stargazers_count = excluded.stargazers_count,
            topics = excluded.topics,
            repo_updated_at = excluded.repo_updated_at`,
    args: [
      r.id,
      r.name,
      r.full_name,
      r.owner.login,
      r.owner.avatar_url,
      r.html_url,
      r.description,
      r.language,
      r.stargazers_count,
      JSON.stringify(r.topics ?? []),
      r.created_at,
      r.updated_at,
    ],
  }));
  const snapshotStmts: InStatement[] = repos.map((repo) => ({
    sql: `INSERT INTO repo_star_snapshots (repo_id, stargazers_count)
          VALUES (?, ?)`,
    args: [repo.id, repo.stargazers_count],
  }));
  const thresholdEventStmts = buildThresholdEventStatements(
    repos,
    previousStarCounts
  );

  await batchDb(db, [...stmts, ...snapshotStmts, ...thresholdEventStmts]);
  return repos.map((r) => r.id);
}

async function embedPending(db: Client, limit: number): Promise<number> {
  const pending = await executeDb(db, {
    sql: `SELECT r.id, r.full_name, r.description, r.language, r.topics, re.text_hash
          FROM repos r
          LEFT JOIN repo_embeddings re ON re.repo_id = r.id
          WHERE r.stargazers_count >= ?
          ORDER BY r.stargazers_count DESC
          LIMIT ?`,
    args: [MIN_STARS_FLOOR, limit * 2], // overfetch — we filter by hash
  });

  const toEmbed: { id: number; text: string; hash: string }[] = [];
  for (const row of pending.rows) {
    const text = buildRepoEmbeddingText({
      full_name: row.full_name as string,
      description: row.description as string | null,
      language: row.language as string | null,
      topics: row.topics as string,
    });
    const hash = textHash(text);
    if (row.text_hash !== hash) {
      toEmbed.push({ id: row.id as number, text, hash });
    }
    if (toEmbed.length >= limit) break;
  }

  if (toEmbed.length === 0) return 0;

  for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
    const batch = toEmbed.slice(i, i + BATCH_SIZE);
    const embeddings = await generateEmbeddings(batch.map((r) => r.text));
    const stmts: InStatement[] = batch.map((item, j) => ({
      sql: `INSERT INTO repo_embeddings (repo_id, embedding, text_hash)
            VALUES (?, vector(?), ?)
            ON CONFLICT(repo_id) DO UPDATE SET
              embedding = excluded.embedding,
              text_hash = excluded.text_hash`,
      args: [item.id, JSON.stringify(embeddings[j]), item.hash],
    }));
    await batchDb(db, stmts);
    console.info(
      `  embedded ${i + batch.length}/${toEmbed.length} (${batch.length} this batch)`
    );
  }

  return toEmbed.length;
}

async function loadCursor(db: Client) {
  const r = await executeDb(db, "SELECT * FROM seed_cursor WHERE id = 1");
  if (r.rows.length === 0) {
    await executeDb(db, "INSERT INTO seed_cursor (id) VALUES (1)");
    return { next_max_stars: 999999999, next_page: 1 };
  }
  return {
    next_max_stars: r.rows[0]!.next_max_stars as number,
    next_page: r.rows[0]!.next_page as number,
  };
}

async function saveCursor(db: Client, next_max_stars: number, next_page: number) {
  await executeDb(db, {
    sql: `UPDATE seed_cursor
          SET next_max_stars = ?, next_page = ?, updated_at = datetime('now')
          WHERE id = 1`,
    args: [next_max_stars, next_page],
  });
}

/**
 * Walk GH search from `cursor.next_max_stars` down to MIN_STARS_FLOOR. Persists cursor
 * between pages so a crash mid-run resumes cleanly. When the walk completes (we've gone
 * below the floor), reset cursor for the next pass — that's how new repos crossing
 * threshold get discovered on subsequent runs.
 */
async function walkAndUpsert(db: Client, ghToken: string) {
  const cursor = await loadCursor(db);
  console.info(
    `[walk] resume cursor: max_stars=${cursor.next_max_stars} page=${cursor.next_page}`
  );

  let max_stars = cursor.next_max_stars;
  let page = cursor.next_page;
  let lowestSeenInBucket = max_stars;
  let upsertedThisRun = 0;

  while (max_stars >= MIN_STARS_FLOOR) {
    const q = `stars:${MIN_STARS_FLOOR}..${max_stars}`;
    console.info(`[walk] q="${q}" page=${page}`);
    const result = await ghSearch(q, page, ghToken);

    if (result.items.length === 0) {
      if (page === 1) break;
      const newMax = lowestSeenInBucket - 1;
      if (newMax < MIN_STARS_FLOOR || newMax === max_stars) break;
      max_stars = newMax;
      page = 1;
      lowestSeenInBucket = newMax;
      continue;
    }

    upsertedThisRun += (await upsertRepos(db, result.items)).length;
    const minStarsInPage = result.items[result.items.length - 1].stargazers_count;
    lowestSeenInBucket = Math.min(lowestSeenInBucket, minStarsInPage);
    page++;

    if (page > MAX_PAGES_PER_BUCKET) {
      max_stars = lowestSeenInBucket - 1;
      page = 1;
      lowestSeenInBucket = max_stars;
    }

    await saveCursor(db, max_stars, page);
    // GH search caps authenticated users at 30 req/min (1 per 2.0s).
    // 2100ms keeps us safely under without idling too much.
    await new Promise((r) => setTimeout(r, 2100));
  }

  // Walk complete. Reset cursor so the next run rediscovers from the top —
  // catches new ≥5k repos and refreshes star counts on existing rows.
  await saveCursor(db, 999999999, 1);
  console.info(
    `[walk] complete. upserted ${upsertedThisRun} repo rows. cursor reset.`
  );
}

async function main() {
  const ghToken = process.env.GITHUB_TOKEN;
  if (!ghToken) throw new Error("GITHUB_TOKEN required");

  const db = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  await walkAndUpsert(db, ghToken);

  console.info(`[embed] generating up to ${DAILY_LIMIT} embeddings`);
  const embedded = await embedPending(db, DAILY_LIMIT);
  console.info(`[embed] generated ${embedded} embeddings`);

  const totals = await executeDb(
    db,
    `SELECT
       (SELECT COUNT(*) FROM repos WHERE stargazers_count >= ${MIN_STARS_FLOOR}) AS repos_in_pool,
       (SELECT COUNT(*) FROM repo_embeddings re
          JOIN repos r ON r.id = re.repo_id
          WHERE r.stargazers_count >= ${MIN_STARS_FLOOR}) AS embedded_in_pool`
  );
  const t = totals.rows[0]!;
  console.info(
    `[done] pool ≥${MIN_STARS_FLOOR} stars: ${t.embedded_in_pool}/${t.repos_in_pool} embedded`
  );
}

main().catch((err) => {
  console.error("Seed run failed:", err);
  process.exit(1);
});
