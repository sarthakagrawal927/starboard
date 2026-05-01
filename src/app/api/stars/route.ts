import type { InStatement, InValue } from "@libsql/client";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { generateEmbedding } from "@/lib/embeddings";
import { expandedSearchQuery, rrfFuse, searchTerms } from "@/lib/search";

// Cache embedding existence check per user (5 min TTL)
const embeddingCheckCache = new Map<string, { value: boolean; expires: number }>();
async function hasEmbeddings(userId: string): Promise<boolean> {
  const cached = embeddingCheckCache.get(userId);
  if (cached && Date.now() < cached.expires) return cached.value;
  const r = await db.execute({
    sql: "SELECT 1 FROM repo_embeddings re JOIN user_repos ur ON ur.repo_id = re.repo_id WHERE ur.user_id = ? LIMIT 1",
    args: [userId],
  });
  const value = r.rows.length > 0;
  embeddingCheckCache.set(userId, { value, expires: Date.now() + 5 * 60_000 });
  return value;
}

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.githubId;
  const params = request.nextUrl.searchParams;

  // Parse query params
  const q = params.get("q")?.trim() || null;
  const languages = params.get("language")?.split(",").filter(Boolean) || [];
  const listId = params.get("list_id");
  const sort = params.get("sort") || "starred";
  const limit = Math.min(Math.max(parseInt(params.get("limit") || "50", 10) || 50, 1), 200);
  const offset = Math.max(parseInt(params.get("offset") || "0", 10) || 0, 0);

  // Build dynamic WHERE clauses
  const whereClauses: string[] = ["ur.user_id = ?", "(ur.is_starred = 1 OR ur.is_saved = 1)"];
  const whereArgs: InValue[] = [userId];

  // Hybrid search: rank-fuse lexical (LIKE w/ column priority) + vector (cosine).
  // Reciprocal Rank Fusion: score = sum 1/(K + rank_i). Items in both lists rise.
  let rankedRepoIds: number[] | null = null;
  if (q) {
    const pattern = `%${q}%`;
    const tokenPatterns = searchTerms(q).map((term) => `%${term}%`);
    const RRF_K = 60;
    const VEC_TOP_K = 500;
    const VEC_DIST_MAX = 0.55; // cosine distance cutoff (lower = more similar)
    const lexicalClauses = [
      "r.name LIKE ? COLLATE NOCASE",
      "r.full_name LIKE ? COLLATE NOCASE",
      "r.description LIKE ? COLLATE NOCASE",
      "r.topics LIKE ? COLLATE NOCASE",
      "ur.notes LIKE ? COLLATE NOCASE",
    ];
    const tokenLexicalSql = tokenPatterns
      .map(() => `(${lexicalClauses.join(" OR ")})`)
      .join(" OR ");
    const tokenScoreSql = tokenPatterns
      .map(
        () => `(CASE
                   WHEN r.name LIKE ? COLLATE NOCASE THEN 20
                   WHEN r.full_name LIKE ? COLLATE NOCASE THEN 14
                   WHEN r.topics LIKE ? COLLATE NOCASE THEN 6
                   WHEN r.description LIKE ? COLLATE NOCASE THEN 3
                   WHEN ur.notes LIKE ? COLLATE NOCASE THEN 2
                   ELSE 0
                 END)`
      )
      .join(" + ");
    const tokenWhereArgs = tokenPatterns.flatMap((token) => [
      token,
      token,
      token,
      token,
      token,
    ]);
    const tokenScoreArgs = tokenPatterns.flatMap((token) => [
      token,
      token,
      token,
      token,
      token,
    ]);

    // 1. Lexical matches across name, full_name, description, topics, notes.
    //    NOCASE for case-insensitive. Order by column priority (name > full_name > rest).
    const lexResult = await db.execute({
      sql: `SELECT r.id,
                   CASE
                     WHEN r.name        LIKE ? COLLATE NOCASE THEN 0
                     WHEN r.full_name   LIKE ? COLLATE NOCASE THEN 1
                     WHEN r.description LIKE ? COLLATE NOCASE THEN 2
                     WHEN r.topics      LIKE ? COLLATE NOCASE THEN 3
                     WHEN ur.notes      LIKE ? COLLATE NOCASE THEN 4
                     ELSE 6
                   END AS priority,
                   ${tokenScoreSql || "0"} AS token_score
            FROM user_repos ur JOIN repos r ON r.id = ur.repo_id
            WHERE ur.user_id = ?
              AND ((r.name        LIKE ? COLLATE NOCASE
                OR r.full_name   LIKE ? COLLATE NOCASE
                OR r.description LIKE ? COLLATE NOCASE
                OR r.topics      LIKE ? COLLATE NOCASE
                OR ur.notes      LIKE ? COLLATE NOCASE)
                ${tokenLexicalSql ? `OR ${tokenLexicalSql}` : ""})
            ORDER BY token_score DESC, priority ASC`,
      args: [
        pattern, pattern, pattern, pattern, pattern,
        ...tokenScoreArgs,
        userId,
        pattern, pattern, pattern, pattern, pattern,
        ...tokenWhereArgs,
      ],
    });
    const lexIds = lexResult.rows.map((r) => r.id as number);

    // 2. Semantic matches via vector_top_k. Pull distance, drop the noisy tail.
    //    vector_top_k is global; user filtering happens in the main query.
    let semIds: number[] = [];
    try {
      if (await hasEmbeddings(userId)) {
        const queryEmbedding = await generateEmbedding(expandedSearchQuery(q));
        const vectorResult = await db.execute({
          sql: `SELECT re.repo_id,
                       vector_distance_cos(re.embedding, vector(?)) AS dist
                FROM vector_top_k('idx_repo_embeddings_vec', vector(?), ?) AS vt
                JOIN repo_embeddings re ON re.rowid = vt.id
                ORDER BY dist ASC`,
          args: [
            JSON.stringify(queryEmbedding),
            JSON.stringify(queryEmbedding),
            VEC_TOP_K,
          ],
        });
        semIds = vectorResult.rows
          .filter((r) => (r.dist as number) <= VEC_DIST_MAX)
          .map((r) => r.repo_id as number);
      }
    } catch (e) {
      console.warn("Semantic search failed:", e);
    }

    // 3. RRF fusion of the two ranked lists.
    const fused = rrfFuse([lexIds, semIds], RRF_K);

    if (fused.length > 0) {
      rankedRepoIds = fused;
      const placeholders = fused.map(() => "?").join(", ");
      whereClauses.push(`r.id IN (${placeholders})`);
      whereArgs.push(...fused);
    } else {
      // No matches — keep LIKE so we don't return the whole library.
      whereClauses.push(
        `((r.name LIKE ? COLLATE NOCASE OR r.full_name LIKE ? COLLATE NOCASE OR r.description LIKE ? COLLATE NOCASE OR r.topics LIKE ? COLLATE NOCASE OR ur.notes LIKE ? COLLATE NOCASE)
          ${tokenLexicalSql ? `OR ${tokenLexicalSql}` : ""})`
      );
      whereArgs.push(pattern, pattern, pattern, pattern, pattern, ...tokenWhereArgs);
    }
  }

  if (languages.length > 0) {
    const placeholders = languages.map(() => "?").join(", ");
    whereClauses.push(`r.language IN (${placeholders})`);
    whereArgs.push(...languages);
  }

  if (listId !== null) {
    whereClauses.push(
      "EXISTS (SELECT 1 FROM user_repo_lists url WHERE url.user_id = ur.user_id AND url.repo_id = ur.repo_id AND url.list_id = ?)"
    );
    whereArgs.push(parseInt(listId, 10));
  }

  const whereSQL = whereClauses.join(" AND ");

  // Sort mapping — use ranked order (exact first, then semantic) with default sort
  const useRankedOrder = rankedRepoIds && rankedRepoIds.length > 0 && sort === "starred";
  const orderByMap: Record<string, string> = {
    starred: "ur.starred_at DESC",
    stars: "r.stargazers_count DESC",
    updated: "r.repo_updated_at DESC",
    name: "r.name ASC",
  };
  let orderBy: string;
  if (useRankedOrder) {
    // Exact matches first (lower index), then semantic matches in similarity order
    const caseLines = rankedRepoIds!.map((id, i) => `WHEN ${id} THEN ${i}`).join(" ");
    orderBy = `CASE r.id ${caseLines} ELSE 999999 END`;
  } else {
    orderBy = orderByMap[sort] || orderByMap.starred;
  }

  try {
    // Main filtered query
    const mainQuery: InStatement = {
      sql: `SELECT r.*, ur.list_id, ur.notes, ur.starred_at, ur.is_starred, ur.is_saved,
                   COALESCE((
                     SELECT json_group_array(url.list_id)
                     FROM user_repo_lists url
                     WHERE url.user_id = ur.user_id AND url.repo_id = ur.repo_id
                   ), '[]') AS collection_ids
            FROM user_repos ur
            JOIN repos r ON r.id = ur.repo_id
            WHERE ${whereSQL}
            ORDER BY ${orderBy}
            LIMIT ? OFFSET ?`,
      args: [...whereArgs, limit, offset],
    };

    // Count query (same filters, no LIMIT/OFFSET)
    const countQuery: InStatement = {
      sql: `SELECT COUNT(*) as total
            FROM user_repos ur
            JOIN repos r ON r.id = ur.repo_id
            WHERE ${whereSQL}`,
      args: [...whereArgs],
    };

    // Facet queries — UNFILTERED (global for this user)
    const languageFacetQuery: InStatement = {
      sql: `SELECT r.language, COUNT(*) as count
            FROM user_repos ur
            JOIN repos r ON r.id = ur.repo_id
            WHERE ur.user_id = ? AND (ur.is_starred = 1 OR ur.is_saved = 1) AND r.language IS NOT NULL AND r.language != ''
            GROUP BY r.language
            ORDER BY count DESC`,
      args: [userId],
    };

    const listFacetQuery: InStatement = {
      sql: `SELECT ul.id, ul.name, ul.color, COUNT(ur.repo_id) as count
            FROM user_lists ul
            LEFT JOIN user_repo_lists url ON url.list_id = ul.id AND url.user_id = ul.user_id
            LEFT JOIN user_repos ur ON ur.user_id = url.user_id AND ur.repo_id = url.repo_id AND (ur.is_starred = 1 OR ur.is_saved = 1)
            WHERE ul.user_id = ?
            GROUP BY ul.id
            ORDER BY ul.position ASC`,
      args: [userId],
    };

    // Run main query + batch the rest in parallel
    const [mainResult, batchResults] = await Promise.all([
      db.execute(mainQuery),
      db.batch([countQuery, languageFacetQuery, listFacetQuery]),
    ]);

    const [countResult, langResult, listResult] = batchResults;

    // Parse main results
    const repos = mainResult.rows.map((row) => ({
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
      created_at: row.repo_created_at as string,
      updated_at: row.repo_updated_at as string,
      list_id: row.list_id as number | null,
      collection_ids: JSON.parse((row.collection_ids as string) || "[]"),
      tags: [],
      notes: row.notes as string | null,
      starred_at: row.starred_at as string,
      is_starred: Boolean(row.is_starred),
      is_saved: Boolean(row.is_saved),
    }));

    const total = countResult.rows[0]?.total as number;

    // Language facets
    const languageFacets: [string, number][] = langResult.rows.map((row) => [
      row.language as string,
      row.count as number,
    ]);

    // List facets
    const listFacets = listResult.rows.map((row) => ({
      id: row.id as number,
      name: row.name as string,
      color: row.color as string,
      count: row.count as number,
    }));

    return NextResponse.json({
      repos,
      total,
      facets: {
        languages: languageFacets,
        lists: listFacets,
        tags: [],
      },
    });
  } catch (error) {
    console.error("Failed to fetch stars:", error);
    return NextResponse.json({ error: "Failed to fetch stars" }, { status: 500 });
  }
}
