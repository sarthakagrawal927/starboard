import { auth } from "@/lib/auth";
import { db } from "@/db";
import { fetchAllStarredRepos, StarredRepo } from "@/lib/github";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();

  if (!session?.accessToken || !session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.githubId;

  try {
    const result = await fetchAllStarredRepos(session.accessToken);

    if (result.notModified) {
      return NextResponse.json({ added: [], removed: [], unchanged: true });
    }

    const freshRepos = result.repos;
    const freshIds = new Set(freshRepos.map((r) => r.id));

    // Load current user_repos
    const existing = await db.execute({
      sql: "SELECT repo_id FROM user_repos WHERE user_id = ?",
      args: [userId],
    });
    const existingIds = new Set(existing.rows.map((r) => r.repo_id as number));

    const added = freshRepos.filter((r) => !existingIds.has(r.id));
    const removedIds = [...existingIds].filter((id) => !freshIds.has(id));

    // Upsert all fresh repos into repos table
    for (const repo of freshRepos) {
      await db.execute({
        sql: `INSERT INTO repos (id, name, full_name, owner_login, owner_avatar, html_url, description, language, stargazers_count, topics, repo_created_at, repo_updated_at)
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
          repo.id, repo.name, repo.full_name, repo.owner.login, repo.owner.avatar_url,
          repo.html_url, repo.description, repo.language, repo.stargazers_count,
          JSON.stringify(repo.topics), repo.created_at, repo.updated_at,
        ],
      });
    }

    // Insert new user_repos
    for (const repo of added) {
      await db.execute({
        sql: "INSERT OR IGNORE INTO user_repos (user_id, repo_id) VALUES (?, ?)",
        args: [userId, repo.id],
      });
    }

    // Remove unstarred repos
    for (const repoId of removedIds) {
      await db.execute({
        sql: "DELETE FROM user_repos WHERE user_id = ? AND repo_id = ?",
        args: [userId, repoId],
      });
    }

    // Get removed repo info for response
    let removedRepos: { id: number; full_name: string; description: string | null }[] = [];
    if (removedIds.length > 0) {
      const placeholders = removedIds.map(() => "?").join(",");
      const removedResult = await db.execute({
        sql: `SELECT id, full_name, description FROM repos WHERE id IN (${placeholders})`,
        args: removedIds,
      });
      removedRepos = removedResult.rows.map((r) => ({
        id: r.id as number,
        full_name: r.full_name as string,
        description: r.description as string | null,
      }));
    }

    return NextResponse.json({
      added: added.map((r) => ({ id: r.id, full_name: r.full_name, description: r.description })),
      removed: removedRepos,
      totalRepos: freshRepos.length,
      unchanged: added.length === 0 && removedIds.length === 0,
    });
  } catch (error) {
    console.error("Sync failed:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
