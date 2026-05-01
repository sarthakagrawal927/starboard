import type { InStatement } from "@libsql/client";
import { type NextRequest,NextResponse } from "next/server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { isRateLimited } from "@/lib/rate-limit";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const session = await auth();
  if (!session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { repoId: rawId } = await params;
  const repoId = parseInt(rawId, 10);

  if (isNaN(repoId)) {
    return NextResponse.json({ error: "Invalid repo ID" }, { status: 400 });
  }

  const userId = session.user.githubId;

  if (await isRateLimited(userId)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    // Check if user already liked this repo
    const existing = await db.execute({
      sql: "SELECT 1 FROM likes WHERE user_id = ? AND repo_id = ?",
      args: [userId, repoId],
    });

    const alreadyLiked = existing.rows.length > 0;

    const mutations: InStatement[] = [];

    if (alreadyLiked) {
      mutations.push({
        sql: "DELETE FROM likes WHERE user_id = ? AND repo_id = ?",
        args: [userId, repoId],
      });
    } else {
      mutations.push({
        sql: "INSERT INTO likes (user_id, repo_id) VALUES (?, ?)",
        args: [userId, repoId],
      });
    }

    // Always get updated count after the mutation
    mutations.push({
      sql: "SELECT COUNT(*) as count FROM likes WHERE repo_id = ?",
      args: [repoId],
    });

    const results = await db.batch(mutations);

    const count = results[1].rows[0].count as number;

    return NextResponse.json({
      liked: !alreadyLiked,
      count,
    });
  } catch (error) {
    console.error("Failed to toggle like:", error);
    return NextResponse.json(
      { error: "Failed to toggle like" },
      { status: 500 }
    );
  }
}
