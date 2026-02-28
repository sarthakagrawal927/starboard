import { db } from "@/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!slug) {
    return NextResponse.json({ error: "Slug is required" }, { status: 400 });
  }

  // Fetch the public list with owner info
  const listResult = await db.execute({
    sql: `SELECT ul.id, ul.name, ul.color, ul.icon, ul.description, ul.user_id,
                 u.username, u.avatar_url
          FROM user_lists ul
          JOIN users u ON u.id = ul.user_id
          WHERE ul.slug = ? AND ul.is_public = 1`,
    args: [slug],
  });

  if (listResult.rows.length === 0) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  const row = listResult.rows[0];

  // Fetch repos in this list
  const reposResult = await db.execute({
    sql: `SELECT r.id, r.full_name, r.description, r.language,
                 r.stargazers_count, r.html_url, r.owner_login, r.owner_avatar,
                 r.topics
          FROM user_repos ur
          JOIN repos r ON r.id = ur.repo_id
          WHERE ur.list_id = ? AND ur.user_id = ?`,
    args: [row.id, row.user_id],
  });

  return NextResponse.json({
    list: {
      id: row.id,
      name: row.name,
      color: row.color,
      icon: row.icon,
      description: row.description,
    },
    owner: {
      username: row.username,
      avatar_url: row.avatar_url,
    },
    repos: reposResult.rows,
  });
}
