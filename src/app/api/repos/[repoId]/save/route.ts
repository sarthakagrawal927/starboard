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

  const { repoId: rawRepoId } = await params;
  const repoId = parseInt(rawRepoId, 10);
  if (Number.isNaN(repoId)) {
    return NextResponse.json({ error: "Invalid repo ID" }, { status: 400 });
  }

  const body = (await request.json()) as { saved?: unknown };
  const isSaved = Boolean(body.saved);

  await db.execute({
    sql: `INSERT INTO user_repos (user_id, repo_id, is_starred, is_saved)
          VALUES (?, ?, 0, ?)
          ON CONFLICT(user_id, repo_id) DO UPDATE SET
            is_saved = excluded.is_saved`,
    args: [session.user.githubId, repoId, isSaved ? 1 : 0],
  });

  return NextResponse.json({ saved: isSaved });
}
