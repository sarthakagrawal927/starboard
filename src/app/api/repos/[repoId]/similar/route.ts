import { type NextRequest, NextResponse } from "next/server";

import { db } from "@/db";
import { auth } from "@/lib/auth";

const VEC_TOP_K = 200;
const DIST_MAX = 0.62;
const DEFAULT_LIMIT = 10;

function parseTopics(value: unknown): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((topic): topic is string => typeof topic === "string") : [];
  } catch {
    return [];
  }
}

function wordSet(value: string | null | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .toLowerCase()
      .split(/[^a-z0-9+#]+/i)
      .filter((word) => word.length >= 3)
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const session = await auth();
  if (!session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.githubId;

  const { repoId: rawId } = await params;
  const repoId = parseInt(rawId, 10);
  if (isNaN(repoId)) {
    return NextResponse.json({ error: "Invalid repo ID" }, { status: 400 });
  }

  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitParam || "", 10) || DEFAULT_LIMIT, 1), 30);
  const scope = request.nextUrl.searchParams.get("scope") || "global"; // "user" | "global"

  try {
    // 1. Fetch this repo's embedding and lightweight metadata.
    const seed = await db.execute({
      sql: `SELECT re.embedding,
                   r.name,
                   r.full_name,
                   r.description,
                   r.language,
                   r.topics
            FROM repo_embeddings re
            JOIN repos r ON r.id = re.repo_id
            WHERE re.repo_id = ?`,
      args: [repoId],
    });
    if (seed.rows.length === 0) {
      return NextResponse.json({ similar: [], reason: "no_embedding" });
    }

    // libsql returns F32_BLOB as a Buffer/Uint8Array; we re-feed it via vector_extract -> JSON.
    // Simpler: query top-k seeded by repo_id directly using a CTE pattern, but vector_top_k
    // requires a vector literal. Use vector_extract to get the JSON form.
    const vecRow = await db.execute({
      sql: "SELECT vector_extract(embedding) AS vec FROM repo_embeddings WHERE repo_id = ?",
      args: [repoId],
    });
    const vec = vecRow.rows[0]?.vec as string | undefined;
    if (!vec) {
      return NextResponse.json({ similar: [], reason: "no_embedding" });
    }

    // 2. ANN search.
    const annResult = await db.execute({
      sql: `SELECT re.repo_id,
                   vector_distance_cos(re.embedding, vector(?)) AS dist
            FROM vector_top_k('idx_repo_embeddings_vec', vector(?), ?) AS vt
            JOIN repo_embeddings re ON re.rowid = vt.id
            WHERE re.repo_id != ?
            ORDER BY dist ASC`,
      args: [vec, vec, VEC_TOP_K, repoId],
    });

    const candidates = annResult.rows
      .filter((r) => (r.dist as number) <= DIST_MAX)
      .map((r) => ({
        repo_id: r.repo_id as number,
        dist: r.dist as number,
      }));

    if (candidates.length === 0) {
      return NextResponse.json({ similar: [] });
    }

    // 3. Hydrate. Optionally restrict to user's own stars.
    const ids = candidates.map((c) => c.repo_id);
    const placeholders = ids.map(() => "?").join(", ");
    const sql =
      scope === "global"
        ? `SELECT r.id, r.name, r.full_name, r.owner_login, r.owner_avatar,
                 r.html_url, r.description, r.language, r.stargazers_count,
                 r.archived, r.topics, r.repo_updated_at
           FROM repos r
           WHERE r.id IN (${placeholders})`
        : `SELECT r.id, r.name, r.full_name, r.owner_login, r.owner_avatar,
                 r.html_url, r.description, r.language, r.stargazers_count,
                 r.archived, r.topics, r.repo_updated_at,
                 ur.list_id,
                 COALESCE((
                   SELECT json_group_array(url.list_id)
                   FROM user_repo_lists url
                   WHERE url.user_id = ur.user_id AND url.repo_id = ur.repo_id
                 ), '[]') AS collection_ids
           FROM user_repos ur
           JOIN repos r ON r.id = ur.repo_id
           WHERE ur.user_id = ? AND r.id IN (${placeholders})`;
    const args = scope === "global" ? ids : [userId, ...ids];

    const hydrated = await db.execute({ sql, args });

    // 4. Re-attach distance and rerank. Vector distance stays primary; shared
    // topics, language, and repo-description terms stabilize close semantic matches.
    const seedRow = seed.rows[0];
    const seedTopics = new Set(parseTopics(seedRow.topics));
    const seedWords = wordSet(
      `${seedRow.full_name as string} ${seedRow.description as string | null}`
    );
    const seedLanguage = (seedRow.language as string | null) ?? null;
    const distMap = new Map(candidates.map((c) => [c.repo_id, c.dist]));
    const repoMap = new Map(hydrated.rows.map((r) => [r.id as number, r]));
    const ordered = ids
      .map((id) => repoMap.get(id))
      .filter((r): r is NonNullable<typeof r> => r != null)
      .map((row) => {
        const dist = distMap.get(row.id as number) ?? 1;
        const similarity = 1 - dist;
        const topics = parseTopics(row.topics);
        const sharedTopics = topics.filter((topic) => seedTopics.has(topic)).length;
        const candidateWords = wordSet(`${row.full_name as string} ${row.description as string | null}`);
        let sharedWords = 0;
        for (const word of candidateWords) {
          if (seedWords.has(word)) sharedWords++;
        }
        const languageBoost =
          seedLanguage && seedLanguage === (row.language as string | null) ? 0.03 : 0;
        const topicBoost = Math.min(sharedTopics * 0.035, 0.14);
        const wordBoost = Math.min(sharedWords * 0.008, 0.04);
        return {
          row,
          similarity,
          score: similarity + languageBoost + topicBoost + wordBoost,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ row, similarity }) => ({
        id: row.id as number,
        name: row.name as string,
        full_name: row.full_name as string,
        owner: {
          login: row.owner_login as string,
          avatar_url: row.owner_avatar as string,
        },
        html_url: row.html_url as string,
        description: row.description as string | null,
        language: row.language as string | null,
        stargazers_count: row.stargazers_count as number,
        archived: Boolean(row.archived),
        topics: parseTopics(row.topics),
        updated_at: row.repo_updated_at as string | null,
        list_id: (row.list_id as number | null | undefined) ?? null,
        collection_ids: row.collection_ids ? JSON.parse((row.collection_ids as string) || "[]") : [],
        tags: [],
        similarity,
      }));

    return NextResponse.json({ similar: ordered });
  } catch (error) {
    console.error("Failed to fetch similar repos:", error);
    return NextResponse.json({ error: "Failed to fetch similar repos" }, { status: 500 });
  }
}
