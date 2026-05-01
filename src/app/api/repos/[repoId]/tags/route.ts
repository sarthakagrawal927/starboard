import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { auth } from "@/lib/auth";

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

  return NextResponse.json(JSON.parse(result.rows[0]["tags"] as string));
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
  const body = (await request.json()) as { tags?: unknown };
  const tags = body.tags;

  if (
    !Array.isArray(tags) ||
    tags.length > 50 ||
    !tags.every((t: unknown) => typeof t === "string" && t.length > 0 && t.length <= 100)
  ) {
    return NextResponse.json(
      { error: "tags must be an array of up to 50 non-empty strings (max 100 chars each)" },
      { status: 400 }
    );
  }

  await db.execute({
    sql: `INSERT INTO user_repos (user_id, repo_id, tags, is_starred)
          VALUES (?, ?, ?, 0)
          ON CONFLICT(user_id, repo_id) DO UPDATE SET
            tags = excluded.tags`,
    args: [session.user.githubId, parseInt(repoId, 10), JSON.stringify(tags)],
  });

  return NextResponse.json({ tags });
}
