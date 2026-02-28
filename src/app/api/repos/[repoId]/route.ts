import { auth } from "@/lib/auth";
import { db } from "@/db";
import { NextResponse, type NextRequest } from "next/server";
import type { InStatement } from "@libsql/client";
import { resolveRepoId } from "../resolve";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const { repoId: rawId } = await params;

  // Support two modes:
  // 1. Numeric ID: /api/repos/12345
  // 2. Slug lookup: /api/repos/lookup?name=owner/repo
  let repoId: number;

  if (rawId === "lookup") {
    const name = request.nextUrl.searchParams.get("name");
    if (!name || !name.includes("/")) {
      return NextResponse.json({ error: "name param required (owner/repo)" }, { status: 400 });
    }
    const [owner, repo] = name.split("/", 2);
    const resolved = await resolveRepoId(owner, repo);
    if (!resolved) {
      return NextResponse.json({ error: "Repository not found" }, { status: 404 });
    }
    repoId = resolved;
  } else {
    repoId = parseInt(rawId, 10);
    if (isNaN(repoId)) {
      return NextResponse.json({ error: "Invalid repo ID" }, { status: 400 });
    }
  }

  try {
    // Look up repo in our DB
    let repoResult = await db.execute({
      sql: "SELECT * FROM repos WHERE id = ?",
      args: [repoId],
    });

    // If not cached locally, fetch from GitHub and upsert
    if (repoResult.rows.length === 0) {
      const ghRes = await fetch(
        `https://api.github.com/repositories/${repoId}`,
        { next: { revalidate: 3600 } }
      );

      if (!ghRes.ok) {
        if (ghRes.status === 404) {
          return NextResponse.json({ error: "Repository not found" }, { status: 404 });
        }
        return NextResponse.json({ error: "Failed to fetch repository from GitHub" }, { status: 502 });
      }

      const gh = await ghRes.json();

      await db.execute({
        sql: `INSERT INTO repos (id, name, full_name, owner_login, owner_avatar, html_url,
                description, language, stargazers_count, topics, repo_created_at, repo_updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                name = excluded.name, full_name = excluded.full_name,
                owner_login = excluded.owner_login, owner_avatar = excluded.owner_avatar,
                html_url = excluded.html_url, description = excluded.description,
                language = excluded.language, stargazers_count = excluded.stargazers_count,
                topics = excluded.topics, repo_created_at = excluded.repo_created_at,
                repo_updated_at = excluded.repo_updated_at`,
        args: [
          gh.id, gh.name, gh.full_name, gh.owner.login, gh.owner.avatar_url,
          gh.html_url, gh.description ?? null, gh.language ?? null,
          gh.stargazers_count, JSON.stringify(gh.topics ?? []),
          gh.created_at, gh.updated_at,
        ],
      });

      repoResult = await db.execute({
        sql: "SELECT * FROM repos WHERE id = ?",
        args: [repoId],
      });
    }

    const row = repoResult.rows[0];

    const session = await auth();
    const userId = session?.user?.githubId ?? null;

    const countQueries: InStatement[] = [
      { sql: "SELECT COUNT(*) as count FROM likes WHERE repo_id = ?", args: [repoId] },
      { sql: "SELECT COUNT(*) as count FROM comments WHERE repo_id = ?", args: [repoId] },
    ];

    if (userId) {
      countQueries.push({
        sql: "SELECT 1 as liked FROM likes WHERE user_id = ? AND repo_id = ?",
        args: [userId, repoId],
      });
    }

    const batchResults = await db.batch(countQueries);

    const likeCount = batchResults[0].rows[0].count as number;
    const commentCount = batchResults[1].rows[0].count as number;
    const userLiked = userId ? batchResults[2].rows.length > 0 : false;

    return NextResponse.json({
      repo: {
        id: row.id as number,
        name: row.name as string,
        full_name: row.full_name as string,
        owner_login: row.owner_login as string,
        owner_avatar: row.owner_avatar as string,
        html_url: row.html_url as string,
        description: row.description as string | null,
        language: row.language as string | null,
        stargazers_count: row.stargazers_count as number,
        topics: JSON.parse((row.topics as string) || "[]"),
        repo_created_at: row.repo_created_at as string | null,
        repo_updated_at: row.repo_updated_at as string | null,
      },
      likeCount,
      commentCount,
      userLiked,
    });
  } catch (error) {
    console.error("Failed to fetch repo detail:", error);
    return NextResponse.json({ error: "Failed to fetch repository" }, { status: 500 });
  }
}
