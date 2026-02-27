import { auth } from "@/lib/auth";
import { db } from "@/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await db.execute({
    sql: "SELECT repo_id, tags FROM user_repos WHERE user_id = ?",
    args: [session.user.githubId],
  });

  const map: Record<number, string[]> = {};
  for (const row of result.rows) {
    const tags = JSON.parse((row.tags as string) || "[]");
    if (tags.length > 0) {
      map[row.repo_id as number] = tags;
    }
  }

  return NextResponse.json(map);
}
