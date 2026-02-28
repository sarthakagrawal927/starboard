import { auth } from "@/lib/auth";
import { db } from "@/db";
import { NextRequest, NextResponse } from "next/server";

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const suffix = Math.random().toString(16).slice(2, 6);
  return `${base}-${suffix}`;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const listId = parseInt(id, 10);
  if (isNaN(listId)) {
    return NextResponse.json({ error: "Invalid list id" }, { status: 400 });
  }

  // Fetch current list state and verify ownership
  const current = await db.execute({
    sql: "SELECT id, name, is_public, slug FROM user_lists WHERE id = ? AND user_id = ?",
    args: [listId, session.user.githubId],
  });

  if (current.rows.length === 0) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  const list = current.rows[0];
  const isCurrentlyPublic = list.is_public === 1;

  if (isCurrentlyPublic) {
    // Make private — keep slug so re-sharing uses the same URL
    await db.execute({
      sql: "UPDATE user_lists SET is_public = 0 WHERE id = ? AND user_id = ?",
      args: [listId, session.user.githubId],
    });

    return NextResponse.json({
      is_public: false,
      slug: list.slug as string,
    });
  } else {
    // Make public — generate slug if none exists
    const slug = list.slug
      ? (list.slug as string)
      : generateSlug(list.name as string);

    await db.execute({
      sql: "UPDATE user_lists SET is_public = 1, slug = ? WHERE id = ? AND user_id = ?",
      args: [slug, listId, session.user.githubId],
    });

    return NextResponse.json({
      is_public: true,
      slug,
    });
  }
}
