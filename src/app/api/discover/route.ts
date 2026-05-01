import type { InStatement, InValue } from "@libsql/client";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { generateEmbedding } from "@/lib/embeddings";
import { rrfFuse } from "@/lib/search";

const MIN_STARS_FLOOR = 5000;

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.githubId;
  const params = request.nextUrl.searchParams;

  const q = params.get("q")?.trim() || null;
  const languages = params.get("language")?.split(",").filter(Boolean) || [];
  const listId = params.get("list_id");
  const tag = params.get("tag")?.trim() || null;
  const sort = params.get("sort") || "stars";
  const limit = Math.min(Math.max(parseInt(params.get("limit") || "50", 10) || 50, 1), 200);
  const offset = Math.max(parseInt(params.get("offset") || "0", 10) || 0, 0);

  const whereClauses: string[] = ["r.stargazers_count >= ?"];
  const whereArgs: InValue[] = [MIN_STARS_FLOOR];

  let rankedRepoIds: number[] | null = null;
  if (q) {
    const pattern = `%${q}%`;
    const RRF_K = 60;
    const VEC_TOP_K = 500;
    const VEC_DIST_MAX = 0.55;

    const lexResult = await db.execute({
      sql: `SELECT r.id,
                   CASE
                     WHEN r.name        LIKE ? COLLATE NOCASE THEN 0
                     WHEN r.full_name   LIKE ? COLLATE NOCASE THEN 1
                     WHEN r.description LIKE ? COLLATE NOCASE THEN 2
                     WHEN r.topics      LIKE ? COLLATE NOCASE THEN 3
                     ELSE 4
                   END AS priority
            FROM repos r
            WHERE r.stargazers_count >= ?
              AND (r.name        LIKE ? COLLATE NOCASE
                OR r.full_name   LIKE ? COLLATE NOCASE
                OR r.description LIKE ? COLLATE NOCASE
                OR r.topics      LIKE ? COLLATE NOCASE)
            ORDER BY priority ASC, r.stargazers_count DESC
            LIMIT 500`,
      args: [
        pattern,
        pattern,
        pattern,
        pattern,
        MIN_STARS_FLOOR,
        pattern,
        pattern,
        pattern,
        pattern,
      ],
    });
    const lexIds = lexResult.rows.map((r) => r["id"] as number);

    let semIds: number[] = [];
    try {
      const queryEmbedding = await generateEmbedding(q);
      const vectorResult = await db.execute({
        sql: `SELECT re.repo_id,
                     vector_distance_cos(re.embedding, vector(?)) AS dist
              FROM vector_top_k('idx_repo_embeddings_vec', vector(?), ?) AS vt
              JOIN repo_embeddings re ON re.rowid = vt.id
              JOIN repos r ON r.id = re.repo_id
              WHERE r.stargazers_count >= ?
              ORDER BY dist ASC`,
        args: [
          JSON.stringify(queryEmbedding),
          JSON.stringify(queryEmbedding),
          VEC_TOP_K,
          MIN_STARS_FLOOR,
        ],
      });
      semIds = vectorResult.rows
        .filter((r) => (r["dist"] as number) <= VEC_DIST_MAX)
        .map((r) => r["repo_id"] as number);
    } catch (error) {
      console.warn("Discover semantic search failed:", error);
    }

    const fused = rrfFuse([lexIds, semIds], RRF_K);
    if (fused.length > 0) {
      rankedRepoIds = fused;
      const placeholders = fused.map(() => "?").join(", ");
      whereClauses.push(`r.id IN (${placeholders})`);
      whereArgs.push(...fused);
    } else {
      whereClauses.push(
        "(r.name LIKE ? COLLATE NOCASE OR r.full_name LIKE ? COLLATE NOCASE OR r.description LIKE ? COLLATE NOCASE OR r.topics LIKE ? COLLATE NOCASE)"
      );
      whereArgs.push(pattern, pattern, pattern, pattern);
    }
  }

  if (languages.length > 0) {
    const placeholders = languages.map(() => "?").join(", ");
    whereClauses.push(`r.language IN (${placeholders})`);
    whereArgs.push(...languages);
  }

  if (listId !== null) {
    whereClauses.push("ur.list_id = ?");
    whereArgs.push(parseInt(listId, 10));
  }

  if (tag) {
    whereClauses.push("instr(ur.tags, ?) > 0");
    whereArgs.push(JSON.stringify(tag));
  }

  const whereSQL = whereClauses.join(" AND ");
  const useRankedOrder = rankedRepoIds && rankedRepoIds.length > 0 && sort === "stars";
  const orderByMap: Record<string, string> = {
    stars: "r.stargazers_count DESC",
    updated: "r.repo_updated_at DESC",
    name: "r.name ASC",
    starred: "r.stargazers_count DESC",
  };
  let orderBy: string;
  if (useRankedOrder) {
    const caseLines = rankedRepoIds!.map((id, i) => `WHEN ${id} THEN ${i}`).join(" ");
    orderBy = `CASE r.id ${caseLines} ELSE 999999 END`;
  } else {
    orderBy = orderByMap[sort] || orderByMap["stars"];
  }

  try {
    const mainQuery: InStatement = {
      sql: `SELECT r.*,
                   ur.list_id,
                   COALESCE(ur.tags, '[]') AS tags,
                   ur.notes,
                   ur.starred_at,
                   COALESCE(ur.is_starred, 0) AS is_starred
            FROM repos r
            LEFT JOIN user_repos ur ON ur.user_id = ? AND ur.repo_id = r.id
            WHERE ${whereSQL}
            ORDER BY ${orderBy}
            LIMIT ? OFFSET ?`,
      args: [userId, ...whereArgs, limit, offset],
    };

    const countQuery: InStatement = {
      sql: `SELECT COUNT(*) as total
            FROM repos r
            LEFT JOIN user_repos ur ON ur.user_id = ? AND ur.repo_id = r.id
            WHERE ${whereSQL}`,
      args: [userId, ...whereArgs],
    };

    const languageFacetQuery: InStatement = {
      sql: `SELECT r.language, COUNT(*) as count
            FROM repos r
            WHERE r.stargazers_count >= ? AND r.language IS NOT NULL AND r.language != ''
            GROUP BY r.language
            ORDER BY count DESC`,
      args: [MIN_STARS_FLOOR],
    };

    const listFacetQuery: InStatement = {
      sql: `SELECT ul.id, ul.name, ul.color, COUNT(r.id) as count
            FROM user_lists ul
            LEFT JOIN user_repos ur ON ur.list_id = ul.id AND ur.user_id = ul.user_id
            LEFT JOIN repos r ON r.id = ur.repo_id AND r.stargazers_count >= ?
            WHERE ul.user_id = ?
            GROUP BY ul.id
            ORDER BY ul.position ASC`,
      args: [MIN_STARS_FLOOR, userId],
    };

    const tagFacetQuery: InStatement = {
      sql: `SELECT ur.tags
            FROM user_repos ur
            JOIN repos r ON r.id = ur.repo_id
            WHERE ur.user_id = ? AND r.stargazers_count >= ? AND ur.tags != '[]'`,
      args: [userId, MIN_STARS_FLOOR],
    };

    const [mainResult, batchResults] = await Promise.all([
      db.execute(mainQuery),
      db.batch([countQuery, languageFacetQuery, listFacetQuery, tagFacetQuery]),
    ]);

    const [countResult, langResult, listResult, tagResult] = batchResults;

    const repos = mainResult.rows.map((row) => ({
      id: row["id"] as number,
      name: row["name"] as string,
      full_name: row["full_name"] as string,
      owner: {
        login: row["owner_login"] as string,
        avatar_url: row["owner_avatar"] as string,
      },
      html_url: row["html_url"] as string,
      description: row["description"] as string | null,
      language: row["language"] as string | null,
      stargazers_count: row["stargazers_count"] as number,
      topics: JSON.parse((row["topics"] as string) || "[]"),
      created_at: row["repo_created_at"] as string,
      updated_at: row["repo_updated_at"] as string,
      list_id: row["list_id"] as number | null,
      tags: JSON.parse((row["tags"] as string) || "[]"),
      notes: row["notes"] as string | null,
      starred_at: row["starred_at"] as string | null,
      is_starred: Boolean(row["is_starred"]),
    }));

    const languages = langResult.rows.map((r) => [
      r["language"] as string,
      r["count"] as number,
    ]);
    const lists = listResult.rows.map((r) => ({
      id: r["id"] as number,
      name: r["name"] as string,
      color: r["color"] as string,
      count: r["count"] as number,
    }));

    const tagCounts = new Map<string, number>();
    for (const row of tagResult.rows) {
      const tags = JSON.parse((row["tags"] as string) || "[]") as string[];
      for (const tag of tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
    const tags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);

    return NextResponse.json({
      repos,
      total: countResult.rows[0]?.["total"] ?? 0,
      facets: { languages, lists, tags },
      minStars: MIN_STARS_FLOOR,
    });
  } catch (error) {
    console.error("Failed to fetch discover repos:", error);
    return NextResponse.json({ error: "Failed to fetch discover repos" }, { status: 500 });
  }
}
