import { type NextRequest,NextResponse } from "next/server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { isRateLimited } from "@/lib/rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ repoId: string; commentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { repoId: rawRepoId, commentId: rawCommentId } = await params;
  const repoId = parseInt(rawRepoId, 10);
  const commentId = parseInt(rawCommentId, 10);

  if (isNaN(repoId) || isNaN(commentId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const body = (await request.json()) as { value?: unknown };
  const value = body?.value;
  if (value !== 1 && value !== -1) {
    return NextResponse.json(
      { error: "value must be 1 or -1" },
      { status: 400 }
    );
  }

  const userId = session.user.githubId;

  if (await isRateLimited(userId)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    // Verify the comment exists and belongs to this repo
    const commentCheck = await db.execute({
      sql: `SELECT id FROM comments WHERE id = ? AND repo_id = ?`,
      args: [commentId, repoId],
    });
    if (commentCheck.rows.length === 0) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Fetch existing vote
    const existingResult = await db.execute({
      sql: `SELECT value FROM comment_votes WHERE user_id = ? AND comment_id = ?`,
      args: [userId, commentId],
    });

    const existingVote =
      existingResult.rows.length > 0
        ? (existingResult.rows[0].value as 1 | -1)
        : null;

    if (existingVote === value) {
      // Toggle off — remove the vote
      await db.execute({
        sql: `DELETE FROM comment_votes WHERE user_id = ? AND comment_id = ?`,
        args: [userId, commentId],
      });
    } else if (existingVote !== null) {
      // Different value — update
      await db.execute({
        sql: `UPDATE comment_votes SET value = ? WHERE user_id = ? AND comment_id = ?`,
        args: [value, userId, commentId],
      });
    } else {
      // No prior vote — insert
      await db.execute({
        sql: `INSERT INTO comment_votes (user_id, comment_id, value) VALUES (?, ?, ?)`,
        args: [userId, commentId, value],
      });
    }

    // Fetch updated counts
    const countsResult = await db.execute({
      sql: `SELECT
              SUM(CASE WHEN value = 1 THEN 1 ELSE 0 END) as upvotes,
              SUM(CASE WHEN value = -1 THEN 1 ELSE 0 END) as downvotes
            FROM comment_votes
            WHERE comment_id = ?`,
      args: [commentId],
    });

    const countsRow = countsResult.rows[0];
    const upvotes = (countsRow?.upvotes as number) ?? 0;
    const downvotes = (countsRow?.downvotes as number) ?? 0;

    const userVote = existingVote === value ? null : (value as 1 | -1);

    return NextResponse.json({ upvotes, downvotes, userVote });
  } catch (error) {
    console.error("Failed to record vote:", error);
    return NextResponse.json(
      { error: "Failed to record vote" },
      { status: 500 }
    );
  }
}
