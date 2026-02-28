import { auth } from "@/lib/auth";
import { db } from "@/db";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
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

  const body = await request.json();
  const updates: string[] = [];
  const args: (string | number | null)[] = [];

  if (body.name !== undefined) { updates.push("name = ?"); args.push(body.name); }
  if (body.color !== undefined) { updates.push("color = ?"); args.push(body.color); }
  if (body.icon !== undefined) { updates.push("icon = ?"); args.push(body.icon); }
  if (body.position !== undefined) { updates.push("position = ?"); args.push(body.position); }
  if (body.is_public !== undefined) { updates.push("is_public = ?"); args.push(body.is_public ? 1 : 0); }
  if (body.slug !== undefined) { updates.push("slug = ?"); args.push(body.slug); }
  if (body.description !== undefined) { updates.push("description = ?"); args.push(body.description); }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  args.push(listId, session.user.githubId);
  const result = await db.execute({
    sql: `UPDATE user_lists SET ${updates.join(", ")} WHERE id = ? AND user_id = ? RETURNING *`,
    args,
  });

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  return NextResponse.json(result.rows[0]);
}

export async function DELETE(
  _request: Request,
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

  await db.execute({
    sql: "DELETE FROM user_lists WHERE id = ? AND user_id = ?",
    args: [listId, session.user.githubId],
  });

  return NextResponse.json({ success: true });
}
