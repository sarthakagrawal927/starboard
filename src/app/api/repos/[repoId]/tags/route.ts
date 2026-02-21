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

  try {
    const { repoId } = await params;
    const repoIdNum = parseInt(repoId, 10);

    if (isNaN(repoIdNum)) {
      return NextResponse.json(
        { error: "Invalid repo id" },
        { status: 400 }
      );
    }

    const result = await db.execute({
      sql: "SELECT t.* FROM tags t JOIN repo_tags rt ON t.id = rt.tag_id WHERE rt.user_id = ? AND rt.repo_id = ?",
      args: [session.user.githubId, repoIdNum],
    });

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Failed to fetch repo tags:", error);
    return NextResponse.json(
      { error: "Failed to fetch repo tags" },
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

  try {
    const { repoId } = await params;
    const repoIdNum = parseInt(repoId, 10);

    if (isNaN(repoIdNum)) {
      return NextResponse.json(
        { error: "Invalid repo id" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { tagId } = body as { tagId: number };

    if (!tagId || typeof tagId !== "number") {
      return NextResponse.json(
        { error: "tagId is required and must be a number" },
        { status: 400 }
      );
    }

    // Verify the tag belongs to this user before assigning
    const tagCheck = await db.execute({
      sql: "SELECT id FROM tags WHERE id = ? AND user_id = ?",
      args: [tagId, session.user.githubId],
    });

    if (tagCheck.rows.length === 0) {
      return NextResponse.json(
        { error: "Tag not found" },
        { status: 404 }
      );
    }

    // Check for duplicate assignment
    const existing = await db.execute({
      sql: "SELECT id FROM repo_tags WHERE user_id = ? AND repo_id = ? AND tag_id = ?",
      args: [session.user.githubId, repoIdNum, tagId],
    });

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "Tag already assigned to this repo" },
        { status: 409 }
      );
    }

    const result = await db.execute({
      sql: "INSERT INTO repo_tags (user_id, repo_id, tag_id) VALUES (?, ?, ?) RETURNING *",
      args: [session.user.githubId, repoIdNum, tagId],
    });

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error("Failed to assign tag to repo:", error);
    return NextResponse.json(
      { error: "Failed to assign tag to repo" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const session = await auth();

  if (!session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { repoId } = await params;
    const repoIdNum = parseInt(repoId, 10);

    if (isNaN(repoIdNum)) {
      return NextResponse.json(
        { error: "Invalid repo id" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { tagId } = body as { tagId: number };

    if (!tagId || typeof tagId !== "number") {
      return NextResponse.json(
        { error: "tagId is required and must be a number" },
        { status: 400 }
      );
    }

    await db.execute({
      sql: "DELETE FROM repo_tags WHERE user_id = ? AND repo_id = ? AND tag_id = ?",
      args: [session.user.githubId, repoIdNum, tagId],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove tag from repo:", error);
    return NextResponse.json(
      { error: "Failed to remove tag from repo" },
      { status: 500 }
    );
  }
}
