import { auth } from "@/lib/auth";
import { db } from "@/db";
import { NextResponse, type NextRequest } from "next/server";
import type { InStatement, InValue } from "@libsql/client";

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
  const tag = params.get("tag")?.trim() || null;
  const sort = params.get("sort") || "starred";
  const limit = Math.min(Math.max(parseInt(params.get("limit") || "50", 10) || 50, 1), 200);
  const offset = Math.max(parseInt(params.get("offset") || "0", 10) || 0, 0);

  // Build dynamic WHERE clauses
  const whereClauses: string[] = ["ur.user_id = ?"];
  const whereArgs: InValue[] = [userId];

  if (q) {
    whereClauses.push("(r.name LIKE ? OR r.full_name LIKE ? OR r.description LIKE ?)");
    const pattern = `%${q}%`;
    whereArgs.push(pattern, pattern, pattern);
  }

  if (languages.length > 0) {
    const placeholders = languages.map(() => "?").join(", ");
    whereClauses.push(`r.language IN (${placeholders})`);
    whereArgs.push(...languages);
  }

  if (listId !== null) {
    if (listId === "0" || listId === "null") {
      whereClauses.push("ur.list_id IS NULL");
    } else {
      whereClauses.push("ur.list_id = ?");
      whereArgs.push(parseInt(listId, 10));
    }
  }

  if (tag) {
    // tags is a JSON array stored as TEXT, use instr for contains check
    whereClauses.push("instr(ur.tags, ?) > 0");
    whereArgs.push(`"${tag}"`);
  }

  const whereSQL = whereClauses.join(" AND ");

  // Sort mapping
  const orderByMap: Record<string, string> = {
    starred: "ur.starred_at DESC",
    stars: "r.stargazers_count DESC",
    updated: "r.repo_updated_at DESC",
    name: "r.name ASC",
  };
  const orderBy = orderByMap[sort] || orderByMap.starred;

  try {
    // Main filtered query
    const mainQuery: InStatement = {
      sql: `SELECT r.*, ur.list_id, ur.tags, ur.notes, ur.starred_at
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
            WHERE ur.user_id = ? AND r.language IS NOT NULL AND r.language != ''
            GROUP BY r.language
            ORDER BY count DESC`,
      args: [userId],
    };

    const listFacetQuery: InStatement = {
      sql: `SELECT ul.id, ul.name, ul.color, COUNT(ur.repo_id) as count
            FROM user_lists ul
            LEFT JOIN user_repos ur ON ur.list_id = ul.id AND ur.user_id = ul.user_id
            WHERE ul.user_id = ?
            GROUP BY ul.id
            ORDER BY ul.position ASC`,
      args: [userId],
    };

    const tagFacetQuery: InStatement = {
      sql: `SELECT ur.tags
            FROM user_repos ur
            WHERE ur.user_id = ? AND ur.tags != '[]'`,
      args: [userId],
    };

    // Run main query + batch the rest in parallel
    const [mainResult, batchResults] = await Promise.all([
      db.execute(mainQuery),
      db.batch([countQuery, languageFacetQuery, listFacetQuery, tagFacetQuery]),
    ]);

    const [countResult, langResult, listResult, tagResult] = batchResults;

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
      tags: JSON.parse((row.tags as string) || "[]"),
      notes: row.notes as string | null,
      starred_at: row.starred_at as string,
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

    // Tag facets — aggregate in JS since SQLite can't iterate JSON arrays natively
    const tagCounts = new Map<string, number>();
    for (const row of tagResult.rows) {
      const tags: string[] = JSON.parse((row.tags as string) || "[]");
      for (const t of tags) {
        tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
      }
    }
    const tagFacets: [string, number][] = Array.from(tagCounts.entries()).sort(
      (a, b) => b[1] - a[1]
    );

    return NextResponse.json({
      repos,
      total,
      facets: {
        languages: languageFacets,
        lists: listFacets,
        tags: tagFacets,
      },
    });
  } catch (error) {
    console.error("Failed to fetch stars:", error);
    return NextResponse.json({ error: "Failed to fetch stars" }, { status: 500 });
  }
}
