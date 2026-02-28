import { auth } from "@/lib/auth";
import { db } from "@/db";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const { repoId: rawId } = await params;
  const repoId = parseInt(rawId, 10);

  if (isNaN(repoId)) {
    return NextResponse.json({ error: "Invalid repo ID" }, { status: 400 });
  }

  try {
    const result = await db.execute({
      sql: `SELECT c.id, c.body, c.created_at,
                   u.id as user_id, u.username, u.avatar_url
            FROM comments c
            JOIN users u ON u.id = c.user_id
            WHERE c.repo_id = ?
            ORDER BY c.created_at ASC`,
      args: [repoId],
    });

    const comments = result.rows.map((row) => ({
      id: row.id as number,
      body: row.body as string,
      created_at: row.created_at as string,
      user: {
        id: row.user_id as string,
        username: row.username as string,
        avatar_url: row.avatar_url as string | null,
      },
    }));

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
