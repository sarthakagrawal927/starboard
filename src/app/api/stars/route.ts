import { auth } from "@/lib/auth";
import { db } from "@/db";
import { NextResponse } from "next/server";

// GET: Always serve from cache. No GitHub calls.
export async function GET() {
  const session = await auth();

  if (!session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cached = await db.execute({
      sql: "SELECT repos_json, fetched_at FROM stars_cache WHERE user_id = ?",
      args: [session.user.githubId],
    });

    if (cached.rows.length > 0) {
      return NextResponse.json({
        repos: JSON.parse(cached.rows[0].repos_json as string),
        fetchedAt: cached.rows[0].fetched_at,
      });
    }

    // No cache yet — return empty, user needs to sync
    return NextResponse.json({ repos: [], fetchedAt: null });
  } catch (error) {
    console.error("Failed to read stars cache:", error);
    return NextResponse.json({ error: "Failed to fetch stars" }, { status: 500 });
  }
}
