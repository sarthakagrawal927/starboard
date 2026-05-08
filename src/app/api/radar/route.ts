import { NextResponse } from "next/server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { buildRadarReport, type RadarRepoInput } from "@/lib/release-radar";

export async function GET() {
  const session = await auth();

  if (!session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await db.execute({
    sql: `SELECT r.id,
                 r.name,
                 r.full_name,
                 r.owner_login,
                 r.owner_avatar,
                 r.html_url,
                 r.description,
                 r.language,
                 r.stargazers_count,
                 r.archived,
                 r.topics,
                 r.repo_updated_at,
                 ur.starred_at,
                 (
                   SELECT rss.stargazers_count
                   FROM repo_star_snapshots rss
                   WHERE rss.repo_id = r.id
                     AND datetime(rss.captured_at) <= datetime('now', '-30 days')
                   ORDER BY datetime(rss.captured_at) DESC
                   LIMIT 1
                 ) AS stars_30d_ago,
                 (
                   SELECT COUNT(*)
                   FROM repo_threshold_events rte
                   WHERE rte.repo_id = r.id
                     AND datetime(rte.crossed_at) >= datetime('now', '-30 days')
                 ) AS threshold_events_30d
          FROM user_repos ur
          JOIN repos r ON r.id = ur.repo_id
          WHERE ur.user_id = ?
            AND (ur.is_starred = 1 OR ur.is_saved = 1)
          ORDER BY r.repo_updated_at DESC, r.stargazers_count DESC
          LIMIT 500`,
    args: [session.user.githubId],
  });

  const repos: RadarRepoInput[] = result.rows.map((row) => ({
    id: row.id as number,
    name: row.name as string,
    fullName: row.full_name as string,
    ownerLogin: row.owner_login as string,
    ownerAvatar: row.owner_avatar as string,
    htmlUrl: row.html_url as string,
    description: row.description as string | null,
    language: row.language as string | null,
    stargazersCount: row.stargazers_count as number,
    archived: Boolean(row.archived),
    topics: JSON.parse((row.topics as string) || "[]"),
    repoUpdatedAt: row.repo_updated_at as string | null,
    starredAt: row.starred_at as string | null,
    starsThirtyDaysAgo: row.stars_30d_ago as number | null,
    thresholdEventsThirtyDays: row.threshold_events_30d as number,
  }));

  return NextResponse.json(buildRadarReport(repos));
}
