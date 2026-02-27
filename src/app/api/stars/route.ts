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
      sql: `SELECT r.*, ur.list_id, ur.tags, ur.notes, ur.starred_at
            FROM user_repos ur
            JOIN repos r ON r.id = ur.repo_id
            WHERE ur.user_id = ?
            ORDER BY ur.starred_at DESC`,
      args: [session.user.githubId],
    });

    const repos = result.rows.map((row) => ({
      id: row.id as number,
      name: row.name as string,
      full_name: row.full_name as string,
      owner: {
        login: row.owner_login as string,
        avatar_url: row.owner_avatar as string,
      },
      html_url: row.html_url as string,
      description: row.description as string | null,
      language: row.language as string | null,
      stargazers_count: row.stargazers_count as number,
      topics: JSON.parse((row.topics as string) || "[]"),
      created_at: row.repo_created_at as string,
      updated_at: row.repo_updated_at as string,
      list_id: row.list_id as number | null,
      tags: JSON.parse((row.tags as string) || "[]"),
      notes: row.notes as string | null,
      starred_at: row.starred_at as string,
    }));

    return NextResponse.json({ repos, fetchedAt: repos.length > 0 ? repos[0].starred_at : null });
  } catch (error) {
    console.error("Failed to fetch stars:", error);
    return NextResponse.json({ error: "Failed to fetch stars" }, { status: 500 });
  }
}
