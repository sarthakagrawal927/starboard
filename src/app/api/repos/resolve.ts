import { db } from "@/db";

/**
 * Resolve owner/repo slug to a numeric repo ID.
 * If the repo isn't in our DB yet, fetches from GitHub and inserts it.
 * Returns the numeric repo ID or null if not found on GitHub.
 */
export async function resolveRepoId(
  owner: string,
  repo: string
): Promise<number | null> {
  const fullName = `${owner}/${repo}`;

  // Check DB first
  const existing = await db.execute({
    sql: "SELECT id FROM repos WHERE full_name = ? COLLATE NOCASE",
    args: [fullName],
  });

  if (existing.rows.length > 0) {
    return existing.rows[0].id as number;
  }

  // Fetch from GitHub
  const ghRes = await fetch(`https://api.github.com/repos/${fullName}`, {
    next: { revalidate: 3600 },
  });

  if (!ghRes.ok) return null;

  const gh = await ghRes.json();

  await db.execute({
    sql: `INSERT INTO repos (id, name, full_name, owner_login, owner_avatar, html_url,
            description, language, stargazers_count, topics, repo_created_at, repo_updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name, full_name = excluded.full_name,
            owner_login = excluded.owner_login, owner_avatar = excluded.owner_avatar,
            html_url = excluded.html_url, description = excluded.description,
            language = excluded.language, stargazers_count = excluded.stargazers_count,
            topics = excluded.topics, repo_created_at = excluded.repo_created_at,
            repo_updated_at = excluded.repo_updated_at`,
    args: [
      gh.id,
      gh.name,
      gh.full_name,
      gh.owner.login,
      gh.owner.avatar_url,
      gh.html_url,
      gh.description ?? null,
      gh.language ?? null,
      gh.stargazers_count,
      JSON.stringify(gh.topics ?? []),
      gh.created_at,
      gh.updated_at,
    ],
  });

  return gh.id as number;
}
