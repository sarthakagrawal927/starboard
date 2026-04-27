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

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length === 0 || body.name.length > 100) {
      return NextResponse.json({ error: "name must be a non-empty string (max 100 chars)" }, { status: 400 });
    }
    updates.push("name = ?"); args.push(body.name.trim());
  }
  if (body.color !== undefined) {
    if (typeof body.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(body.color)) {
      return NextResponse.json({ error: "color must be a valid hex color (e.g. #6366f1)" }, { status: 400 });
    }
    updates.push("color = ?"); args.push(body.color);
  }
  if (body.icon !== undefined) {
    if (body.icon !== null && (typeof body.icon !== "string" || body.icon.length > 50)) {
      return NextResponse.json({ error: "icon must be null or a string (max 50 chars)" }, { status: 400 });
    }
    updates.push("icon = ?"); args.push(body.icon);
  }
  if (body.position !== undefined) {
    if (typeof body.position !== "number" || !Number.isInteger(body.position) || body.position < 0) {
      return NextResponse.json({ error: "position must be a non-negative integer" }, { status: 400 });
    }
    updates.push("position = ?"); args.push(body.position);
  }
  if (body.is_public !== undefined) { updates.push("is_public = ?"); args.push(body.is_public ? 1 : 0); }
  if (body.slug !== undefined) {
    if (body.slug !== null && (typeof body.slug !== "string" || !/^[a-z0-9-]{1,100}$/.test(body.slug))) {
      return NextResponse.json({ error: "slug must be null or a lowercase alphanumeric-dash string (max 100 chars)" }, { status: 400 });
    }
    updates.push("slug = ?"); args.push(body.slug);
  }
  if (body.description !== undefined) {
    if (body.description !== null && (typeof body.description !== "string" || body.description.length > 500)) {
      return NextResponse.json({ error: "description must be null or a string (max 500 chars)" }, { status: 400 });
    }
    updates.push("description = ?"); args.push(body.description);
  }

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
