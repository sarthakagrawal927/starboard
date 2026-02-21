import { auth } from "@/lib/auth";
import { db } from "@/db";
import { NextResponse } from "next/server";

async function getCollection(githubId: string, slug: string) {
  const collection = await db.execute({
    sql: "SELECT * FROM collections WHERE user_id = ? AND slug = ?",
    args: [githubId, slug],
  });

  if (!collection.rows.length) {
    return null;
  }

  return collection.rows[0];
}

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

    const collection = await getCollection(session.user.githubId, slug);
    if (!collection) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const repos = await db.execute({
      sql: "SELECT repo_id FROM collection_repos WHERE collection_id = ?",
      args: [collection.id as number],
    });

    return NextResponse.json(repos.rows.map((row) => row.repo_id));
  } catch (error) {
    console.error("Failed to list collection repos:", error);
    return NextResponse.json(
      { error: "Failed to list collection repos" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();

  if (!session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { slug } = await params;

    const collection = await getCollection(session.user.githubId, slug);
    if (!collection) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const { repoId } = body;

    if (typeof repoId !== "number") {
      return NextResponse.json(
        { error: "repoId must be a number" },
        { status: 400 }
      );
    }

    // Check if repo is already in this collection
    const existing = await db.execute({
      sql: "SELECT id FROM collection_repos WHERE collection_id = ? AND repo_id = ?",
      args: [collection.id as number, repoId],
    });

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "Repo already in collection" },
        { status: 409 }
      );
    }

    await db.execute({
      sql: "INSERT INTO collection_repos (collection_id, repo_id) VALUES (?, ?)",
      args: [collection.id as number, repoId],
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Failed to add repo to collection:", error);
    return NextResponse.json(
      { error: "Failed to add repo to collection" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();

  if (!session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { slug } = await params;

    const collection = await getCollection(session.user.githubId, slug);
    if (!collection) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const { repoId } = body;

    if (typeof repoId !== "number") {
      return NextResponse.json(
        { error: "repoId must be a number" },
        { status: 400 }
      );
    }

    const result = await db.execute({
      sql: "DELETE FROM collection_repos WHERE collection_id = ? AND repo_id = ?",
      args: [collection.id as number, repoId],
    });

    if (result.rowsAffected === 0) {
      return NextResponse.json(
        { error: "Repo not found in collection" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove repo from collection:", error);
    return NextResponse.json(
      { error: "Failed to remove repo from collection" },
      { status: 500 }
    );
  }
}
