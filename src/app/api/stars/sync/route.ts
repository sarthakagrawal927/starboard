import { auth } from "@/lib/auth";
import { db } from "@/db";
import { fetchAllStarredRepos } from "@/lib/github";
import { fetchPublicStarLists } from "@/lib/github-lists";
import { NextResponse } from "next/server";
import type { InStatement } from "@libsql/client";

export async function POST() {
  const session = await auth();

  if (!session?.accessToken || !session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.githubId;

  try {
    const username = await getGitHubUsername(userId);
    const result = await fetchAllStarredRepos(session.accessToken);

    if (result.notModified) {
      const importedLists = username ? await importMissingGitHubLists(userId, username) : [];
      return NextResponse.json({
        added: [],
        removed: [],
        importedLists,
        totalRepos: 0,
        unchanged: importedLists.length === 0,
      });
    }

    const freshRepos = result.repos;
    const freshIds = new Set(freshRepos.map((r) => r.id));

    // Load current user_repos
    const existing = await db.execute({
      sql: "SELECT repo_id FROM user_repos WHERE user_id = ?",
      args: [userId],
    });
    const existingIds = new Set(existing.rows.map((r) => r.repo_id as number));

    const added = freshRepos.filter((r) => !existingIds.has(r.id));
    const removedIds = [...existingIds].filter((id) => !freshIds.has(id));

    // Batch upsert all repos + insert new user_repos + delete removed in one round-trip
    const statements: InStatement[] = [];

    for (const repo of freshRepos) {
      statements.push({
        sql: `INSERT INTO repos (id, name, full_name, owner_login, owner_avatar, html_url, description, language, stargazers_count, topics, repo_created_at, repo_updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                full_name = excluded.full_name,
                owner_login = excluded.owner_login,
                owner_avatar = excluded.owner_avatar,
                html_url = excluded.html_url,
                description = excluded.description,
                language = excluded.language,
                stargazers_count = excluded.stargazers_count,
                topics = excluded.topics,
                repo_updated_at = excluded.repo_updated_at`,
        args: [
          repo.id, repo.name, repo.full_name, repo.owner.login, repo.owner.avatar_url,
          repo.html_url, repo.description, repo.language, repo.stargazers_count,
          JSON.stringify(repo.topics), repo.created_at, repo.updated_at,
        ],
      });
    }

    for (const repo of added) {
      statements.push({
        sql: "INSERT OR IGNORE INTO user_repos (user_id, repo_id) VALUES (?, ?)",
        args: [userId, repo.id],
      });
    }

    for (const repoId of removedIds) {
      statements.push({
        sql: "DELETE FROM user_repos WHERE user_id = ? AND repo_id = ?",
        args: [userId, repoId],
      });
    }

    // Execute all in one batch round-trip
    await db.batch(statements);

    const importedLists = username ? await importMissingGitHubLists(userId, username) : [];

    // Get removed repo info for response
    let removedRepos: { id: number; full_name: string; description: string | null }[] = [];
    if (removedIds.length > 0) {
      const placeholders = removedIds.map(() => "?").join(",");
      const removedResult = await db.execute({
        sql: `SELECT id, full_name, description FROM repos WHERE id IN (${placeholders})`,
        args: removedIds,
      });
      removedRepos = removedResult.rows.map((r) => ({
        id: r.id as number,
        full_name: r.full_name as string,
        description: r.description as string | null,
      }));
    }

    return NextResponse.json({
      added: added.map((r) => ({ id: r.id, full_name: r.full_name, description: r.description })),
      removed: removedRepos,
      importedLists,
      totalRepos: freshRepos.length,
      unchanged: added.length === 0 && removedIds.length === 0 && importedLists.length === 0,
    });
  } catch (error) {
    console.error("Sync failed:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

async function getGitHubUsername(userId: string): Promise<string | null> {
  const result = await db.execute({
    sql: "SELECT username FROM users WHERE id = ?",
    args: [userId],
  });

  const username = result.rows[0]?.username;
  return typeof username === "string" && username.trim().length > 0 ? username : null;
}

async function importMissingGitHubLists(userId: string, username: string): Promise<string[]> {
  try {
    const githubLists = await fetchPublicStarLists(username);
    if (githubLists.length === 0) {
      return [];
    }

    const existingLists = await db.execute({
      sql: "SELECT name, position FROM user_lists WHERE user_id = ? ORDER BY position ASC",
      args: [userId],
    });

    const existingNames = new Set(
      existingLists.rows
        .map((row) => row.name)
        .filter((name): name is string => typeof name === "string")
        .map(normalizeListName)
    );
    let nextPosition =
      existingLists.rows.reduce((max, row) => {
        const position = typeof row.position === "number" ? row.position : -1;
        return Math.max(max, position);
      }, -1) + 1;

    const statements: InStatement[] = [];
    const importedLists: string[] = [];

    for (const list of githubLists) {
      const normalizedName = normalizeListName(list.name);
      if (!normalizedName || existingNames.has(normalizedName)) {
        continue;
      }

      statements.push({
        sql: "INSERT INTO user_lists (user_id, name, color, icon, position) VALUES (?, ?, ?, ?, ?)",
        args: [userId, list.name, "#6366f1", null, nextPosition],
      });
      importedLists.push(list.name);
      existingNames.add(normalizedName);
      nextPosition++;
    }

    if (statements.length > 0) {
      await db.batch(statements);
    }

    return importedLists;
  } catch (error) {
    console.warn("GitHub list import skipped:", error);
    return [];
  }
}

function normalizeListName(name: string): string {
  return name.trim().toLowerCase();
}
