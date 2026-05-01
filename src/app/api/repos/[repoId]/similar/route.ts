import { type NextRequest, NextResponse } from "next/server";

import { db } from "@/db";
import { auth } from "@/lib/auth";

const VEC_TOP_K = 60;
const DIST_MAX = 0.55;
const DEFAULT_LIMIT = 10;

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
    // 1. Fetch this repo's embedding.
    const seed = await db.execute({
      sql: "SELECT embedding FROM repo_embeddings WHERE repo_id = ?",
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
                 r.html_url, r.description, r.language, r.stargazers_count, r.topics
           FROM repos r
           WHERE r.id IN (${placeholders})`
        : `SELECT r.id, r.name, r.full_name, r.owner_login, r.owner_avatar,
                 r.html_url, r.description, r.language, r.stargazers_count, r.topics,
                 ur.list_id, ur.tags
           FROM user_repos ur
           JOIN repos r ON r.id = ur.repo_id
           WHERE ur.user_id = ? AND r.id IN (${placeholders})`;
    const args = scope === "global" ? ids : [userId, ...ids];

    const hydrated = await db.execute({ sql, args });

    // 4. Re-attach distance, preserve ANN order, slice to limit.
    const distMap = new Map(candidates.map((c) => [c.repo_id, c.dist]));
    const repoMap = new Map(hydrated.rows.map((r) => [r.id as number, r]));
    const ordered = ids
      .map((id) => repoMap.get(id))
      .filter((r): r is NonNullable<typeof r> => r != null)
      .slice(0, limit)
      .map((row) => ({
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
        topics: JSON.parse((row.topics as string) || "[]"),
        list_id: (row.list_id as number | null | undefined) ?? null,
        tags: row.tags ? JSON.parse((row.tags as string) || "[]") : [],
        similarity: 1 - (distMap.get(row.id as number) ?? 1),
      }));

    return NextResponse.json({ similar: ordered });
  } catch (error) {
    console.error("Failed to fetch similar repos:", error);
    return NextResponse.json({ error: "Failed to fetch similar repos" }, { status: 500 });
  }
}
