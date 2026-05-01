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
  const body = (await request.json()) as { listId?: number | null };
  const listId = body.listId;

  await db.execute({
    sql: `INSERT INTO user_repos (user_id, repo_id, list_id, is_starred, is_saved)
          VALUES (?, ?, ?, 0, ?)
          ON CONFLICT(user_id, repo_id) DO UPDATE SET
            list_id = excluded.list_id,
            is_saved = CASE WHEN excluded.list_id IS NULL THEN user_repos.is_saved ELSE 1 END`,
    args: [session.user.githubId, parseInt(repoId, 10), listId ?? null, listId == null ? 0 : 1],
  });

  return NextResponse.json({ success: true });
}
