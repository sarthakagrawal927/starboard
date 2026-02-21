import { auth } from "@/lib/auth";
import { db } from "@/db";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();

  if (!session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { slug } = await params;

    const collection = await db.execute({
      sql: "SELECT * FROM collections WHERE user_id = ? AND slug = ?",
      args: [session.user.githubId, slug],
    });

    if (!collection.rows.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(collection.rows[0]);
  } catch (error) {
    console.error("Failed to get collection:", error);
    return NextResponse.json(
      { error: "Failed to get collection" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();

  if (!session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { slug } = await params;

    const collection = await db.execute({
      sql: "SELECT * FROM collections WHERE user_id = ? AND slug = ?",
      args: [session.user.githubId, slug],
    });

    if (!collection.rows.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.execute({
      sql: "DELETE FROM collections WHERE user_id = ? AND slug = ?",
      args: [session.user.githubId, slug],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete collection:", error);
    return NextResponse.json(
      { error: "Failed to delete collection" },
      { status: 500 }
    );
  }
}
