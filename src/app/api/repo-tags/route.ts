import { auth } from "@/lib/auth";
import { db } from "@/db";
import { NextResponse } from "next/server";

// Returns ALL repo-tag assignments for the current user in one call
// Shape: { [repoId: number]: number[] (tag IDs) }
export async function GET() {
  const session = await auth();

  if (!session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await db.execute({
      sql: "SELECT repo_id, tag_id FROM repo_tags WHERE user_id = ?",
      args: [session.user.githubId],
    });

    const map: Record<number, number[]> = {};
    for (const row of result.rows) {
      const repoId = row.repo_id as number;
      const tagId = row.tag_id as number;
      if (!map[repoId]) map[repoId] = [];
      map[repoId].push(tagId);
    }

    return NextResponse.json(map);
  } catch (error) {
    console.error("Failed to fetch repo tags:", error);
    return NextResponse.json(
      { error: "Failed to fetch repo tags" },
      { status: 500 }
    );
  }
}
