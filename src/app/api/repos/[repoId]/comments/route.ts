import { auth } from "@/lib/auth";
import { db } from "@/db";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const { repoId: rawId } = await params;
  const repoId = parseInt(rawId, 10);

  if (isNaN(repoId)) {
    return NextResponse.json({ error: "Invalid repo ID" }, { status: 400 });
  }

  const session = await auth();
  const userId = session?.user?.githubId ?? null;

  try {
    const [commentsResult, votesResult] = await db.batch([
      {
        sql: `SELECT c.id, c.body, c.created_at,
                     u.id as user_id, u.username, u.avatar_url
              FROM comments c
              JOIN users u ON u.id = c.user_id
              WHERE c.repo_id = ?
              ORDER BY c.created_at ASC`,
        args: [repoId],
      },
      {
        sql: `SELECT cv.comment_id,
                     SUM(CASE WHEN cv.value = 1 THEN 1 ELSE 0 END) as upvotes,
                     SUM(CASE WHEN cv.value = -1 THEN 1 ELSE 0 END) as downvotes
              FROM comment_votes cv
              JOIN comments c ON c.id = cv.comment_id
              WHERE c.repo_id = ?
              GROUP BY cv.comment_id`,
        args: [repoId],
      },
    ]);

    // Build vote count map
    const voteMap = new Map<
      number,
      { upvotes: number; downvotes: number }
    >();
    for (const row of votesResult.rows) {
      voteMap.set(row.comment_id as number, {
        upvotes: (row.upvotes as number) ?? 0,
        downvotes: (row.downvotes as number) ?? 0,
      });
    }

    // Fetch user's own votes if authenticated
    let userVoteMap = new Map<number, 1 | -1>();
    if (userId) {
      const userVotesResult = await db.execute({
        sql: `SELECT cv.comment_id, cv.value
              FROM comment_votes cv
              JOIN comments c ON c.id = cv.comment_id
              WHERE c.repo_id = ? AND cv.user_id = ?`,
        args: [repoId, userId],
      });
      for (const row of userVotesResult.rows) {
        userVoteMap.set(row.comment_id as number, row.value as 1 | -1);
      }
    }

    const comments = commentsResult.rows.map((row) => {
      const commentId = row.id as number;
      const counts = voteMap.get(commentId) ?? { upvotes: 0, downvotes: 0 };
      return {
        id: commentId,
        body: row.body as string,
        created_at: row.created_at as string,
        user: {
          id: row.user_id as string,
          username: row.username as string,
          avatar_url: row.avatar_url as string | null,
        },
        upvotes: counts.upvotes,
        downvotes: counts.downvotes,
        userVote: userVoteMap.get(commentId) ?? null,
      };
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error("Failed to fetch comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
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

  const { body } = await request.json();

  if (typeof body !== "string" || body.trim().length === 0) {
    return NextResponse.json(
      { error: "Body is required" },
      { status: 400 }
    );
  }

  if (body.length > 2000) {
    return NextResponse.json(
      { error: "Body must be 2000 characters or less" },
      { status: 400 }
    );
  }

  const userId = session.user.githubId;
  const trimmedBody = body.trim();

  try {
    const insertResult = await db.execute({
      sql: `INSERT INTO comments (repo_id, user_id, body) VALUES (?, ?, ?)`,
      args: [repoId, userId, trimmedBody],
    });

    const commentId = Number(insertResult.lastInsertRowid);

    // Fetch the created comment with user info
    const result = await db.execute({
      sql: `SELECT c.id, c.body, c.created_at,
                   u.id as user_id, u.username, u.avatar_url
            FROM comments c
            JOIN users u ON u.id = c.user_id
            WHERE c.id = ?`,
      args: [commentId],
    });

    const row = result.rows[0];

    return NextResponse.json(
      {
        id: row.id as number,
        body: row.body as string,
        created_at: row.created_at as string,
        user: {
          id: row.user_id as string,
          username: row.username as string,
          avatar_url: row.avatar_url as string | null,
        },
        upvotes: 0,
        downvotes: 0,
        userVote: null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create comment:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}
