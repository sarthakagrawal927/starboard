import { auth } from "@/lib/auth";
import { db } from "@/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const session = await auth();
  if (!session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { repoId } = await params;
  const result = await db.execute({
    sql: "SELECT tags FROM user_repos WHERE user_id = ? AND repo_id = ?",
    args: [session.user.githubId, parseInt(repoId, 10)],
  });

  if (result.rows.length === 0) {
    return NextResponse.json([]);
  }

  return NextResponse.json(JSON.parse(result.rows[0].tags as string));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const session = await auth();
  if (!session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { repoId } = await params;
  const { tags } = await request.json();

  if (!Array.isArray(tags) || !tags.every((t: unknown) => typeof t === "string")) {
    return NextResponse.json({ error: "tags must be an array of strings" }, { status: 400 });
  }

  await db.execute({
    sql: "UPDATE user_repos SET tags = ? WHERE user_id = ? AND repo_id = ?",
    args: [JSON.stringify(tags), session.user.githubId, parseInt(repoId, 10)],
  });

  return NextResponse.json({ tags });
}
