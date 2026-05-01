import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { auth } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const session = await auth();
  if (!session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { repoId } = await params;
  const parsedRepoId = parseInt(repoId, 10);
  if (Number.isNaN(parsedRepoId)) {
    return NextResponse.json({ error: "Invalid repo ID" }, { status: 400 });
  }

  const body = (await request.json()) as { listId?: unknown; assigned?: unknown };
  if (typeof body.listId !== "number" || !Number.isInteger(body.listId)) {
    return NextResponse.json({ error: "listId must be an integer" }, { status: 400 });
  }
  const listId = body.listId;
  const assigned = body.assigned !== false;
  const listResult = await db.execute({
    sql: "SELECT id FROM user_lists WHERE id = ? AND user_id = ?",
    args: [listId, session.user.githubId],
  });
  if (listResult.rows.length === 0) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  await db.execute({
    sql: `INSERT INTO user_repos (user_id, repo_id, is_starred, is_saved)
          VALUES (?, ?, 0, ?)
          ON CONFLICT(user_id, repo_id) DO UPDATE SET
            is_saved = CASE WHEN excluded.is_saved = 1 THEN 1 ELSE user_repos.is_saved END`,
    args: [session.user.githubId, parsedRepoId, assigned ? 1 : 0],
  });

  if (assigned) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO user_repo_lists (user_id, repo_id, list_id)
            VALUES (?, ?, ?)`,
      args: [session.user.githubId, parsedRepoId, listId],
    });
  } else {
    await db.execute({
      sql: "DELETE FROM user_repo_lists WHERE user_id = ? AND repo_id = ? AND list_id = ?",
      args: [session.user.githubId, parsedRepoId, listId],
    });
  }

  return NextResponse.json({ success: true, assigned });
}
