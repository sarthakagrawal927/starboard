import { auth } from "@/lib/auth";
import { db } from "@/db";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const session = await auth();
  if (!session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { repoId } = await params;
  const { listId } = await request.json();

  await db.execute({
    sql: "UPDATE user_repos SET list_id = ? WHERE user_id = ? AND repo_id = ?",
    args: [listId ?? null, session.user.githubId, parseInt(repoId, 10)],
  });

  return NextResponse.json({ success: true });
}
