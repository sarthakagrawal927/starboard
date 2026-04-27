import { auth } from "@/lib/auth";
import { db } from "@/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await db.execute({
    sql: "SELECT * FROM user_lists WHERE user_id = ? ORDER BY position ASC",
    args: [session.user.githubId],
  });

  return NextResponse.json(result.rows);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, color, icon } = await request.json();
  if (!name || typeof name !== "string" || name.trim().length === 0 || name.length > 100) {
    return NextResponse.json({ error: "name must be a non-empty string (max 100 chars)" }, { status: 400 });
  }
  if (color !== undefined && (typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color))) {
    return NextResponse.json({ error: "color must be a valid hex color (e.g. #6366f1)" }, { status: 400 });
  }

  const posResult = await db.execute({
    sql: "SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM user_lists WHERE user_id = ?",
    args: [session.user.githubId],
  });
  const nextPos = posResult.rows[0].next_pos as number;

  const result = await db.execute({
    sql: "INSERT INTO user_lists (user_id, name, color, icon, position) VALUES (?, ?, ?, ?, ?) RETURNING *",
    args: [session.user.githubId, name.trim(), color || "#6366f1", icon || null, nextPos],
  });

  return NextResponse.json(result.rows[0], { status: 201 });
}
