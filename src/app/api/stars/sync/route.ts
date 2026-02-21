import { auth } from "@/lib/auth";
import { db } from "@/db";
import { fetchAllStarredRepos, StarredRepo } from "@/lib/github";
import { NextResponse } from "next/server";

// POST: Fetch fresh data from GitHub, diff against cache, return changes.
// The client decides what to do with removed repos.
export async function POST() {
  const session = await auth();

  if (!session?.accessToken || !session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.githubId;

  try {
    // Fetch fresh from GitHub (no ETag — always full fetch on manual sync)
    const result = await fetchAllStarredRepos(session.accessToken);

    if (result.notModified) {
      // Shouldn't happen without ETag, but handle gracefully
      return NextResponse.json({ added: [], removed: [], unchanged: true });
    }

    const freshRepos = result.repos;
    const freshIds = new Set(freshRepos.map((r) => r.id));

    // Load cached repos
    const cached = await db.execute({
      sql: "SELECT repos_json FROM stars_cache WHERE user_id = ?",
      args: [userId],
    });

    let cachedRepos: StarredRepo[] = [];
    if (cached.rows.length > 0) {
      cachedRepos = JSON.parse(cached.rows[0].repos_json as string);
    }
    const cachedIds = new Set(cachedRepos.map((r) => r.id));

    // Diff
    const added = freshRepos.filter((r) => !cachedIds.has(r.id));
    const removed = cachedRepos.filter((r) => !freshIds.has(r.id));

    // Update cache with fresh data (keep all fresh repos)
    const reposJson = JSON.stringify(freshRepos);
    if (cached.rows.length > 0) {
      await db.execute({
        sql: "UPDATE stars_cache SET repos_json = ?, etag = ?, fetched_at = datetime('now') WHERE user_id = ?",
        args: [reposJson, result.etag, userId],
      });
    } else {
      await db.execute({
        sql: "INSERT INTO stars_cache (user_id, repos_json, etag) VALUES (?, ?, ?)",
        args: [userId, reposJson, result.etag],
      });
    }

    return NextResponse.json({
      added: added.map((r) => ({ id: r.id, full_name: r.full_name, description: r.description })),
      removed: removed.map((r) => ({ id: r.id, full_name: r.full_name, description: r.description })),
      totalRepos: freshRepos.length,
      unchanged: added.length === 0 && removed.length === 0,
    });
  } catch (error) {
    console.error("Sync failed:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
