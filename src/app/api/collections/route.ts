import { auth } from "@/lib/auth";
import { db } from "@/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();

  if (!session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await db.execute({
      sql: "SELECT * FROM collections WHERE user_id = ? ORDER BY created_at DESC",
      args: [session.user.githubId],
    });

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Failed to list collections:", error);
    return NextResponse.json(
      { error: "Failed to list collections" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    if (!slug) {
      return NextResponse.json(
        { error: "Name must contain at least one alphanumeric character" },
        { status: 400 }
      );
    }

    // Check for duplicate slug for this user
    const existing = await db.execute({
      sql: "SELECT id FROM collections WHERE user_id = ? AND slug = ?",
      args: [session.user.githubId, slug],
    });

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "A collection with this name already exists" },
        { status: 409 }
      );
    }

    const result = await db.execute({
      sql: "INSERT INTO collections (user_id, name, slug, description) VALUES (?, ?, ?, ?) RETURNING *",
      args: [session.user.githubId, name, slug, description ?? null],
    });

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error("Failed to create collection:", error);
    return NextResponse.json(
      { error: "Failed to create collection" },
      { status: 500 }
    );
  }
}
