import type { InStatement } from "@libsql/client";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { buildRepoEmbeddingText, generateEmbeddings, textHash } from "@/lib/embeddings";
import { fetchAllStarredRepos } from "@/lib/github";
import {
  fetchPublicStarListRepoNames,
  fetchPublicStarLists,
  type GitHubStarList,
} from "@/lib/github-lists";
import { isRateLimited } from "@/lib/rate-limit";

const BOGUS_IMPORTED_SORT_LISTS = new Set([
  "name ascending (a-z)",
  "name descending (z-a)",
  "newest",
  "oldest",
  "last updated",
]);

interface GitHubListSyncResult {
  importedLists: string[];
  assignedRepos: number;
  changed: boolean;
}

export async function POST() {
  const session = await auth();

  if (!session?.accessToken || !session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.githubId;

  if (await isRateLimited(userId)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const username = await getGitHubUsername(userId);
    const result = await fetchAllStarredRepos(session.accessToken);

    if (result.notModified) {
      const repoIdByFullName = await loadRepoIdsByFullName(userId);
      const githubSync = username
        ? await syncGitHubLists(userId, username, repoIdByFullName)
        : emptyGitHubListSync();

      return NextResponse.json({
        added: [],
        removed: [],
        importedLists: githubSync.importedLists,
        assignedRepos: githubSync.assignedRepos,
        totalRepos: repoIdByFullName.size,
        unchanged: !githubSync.changed,
      });
    }

    const freshRepos = result.repos;
    const freshIds = new Set(freshRepos.map((r) => r.id));

    const existing = await db.execute({
      sql: "SELECT repo_id FROM user_repos WHERE user_id = ? AND is_starred = 1",
      args: [userId],
    });
    const existingIds = new Set(existing.rows.map((r) => r.repo_id as number));

    const added = freshRepos.filter((r) => !existingIds.has(r.id));
    const removedIds = [...existingIds].filter((id) => !freshIds.has(id));

    const statements: InStatement[] = [];

    for (const repo of freshRepos) {
      statements.push({
        sql: `INSERT INTO repos (id, name, full_name, owner_login, owner_avatar, html_url, description, language, stargazers_count, archived, topics, repo_created_at, repo_updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                full_name = excluded.full_name,
                owner_login = excluded.owner_login,
                owner_avatar = excluded.owner_avatar,
                html_url = excluded.html_url,
                description = excluded.description,
                language = excluded.language,
                stargazers_count = excluded.stargazers_count,
                archived = excluded.archived,
                topics = excluded.topics,
                repo_updated_at = excluded.repo_updated_at`,
        args: [
          repo.id, repo.name, repo.full_name, repo.owner.login, repo.owner.avatar_url,
          repo.html_url, repo.description, repo.language, repo.stargazers_count,
          repo.archived ? 1 : 0,
          JSON.stringify(repo.topics), repo.created_at, repo.updated_at,
        ],
      });
    }

    for (const repo of added) {
      statements.push({
        sql: `INSERT INTO user_repos (user_id, repo_id, is_starred, starred_at)
              VALUES (?, ?, 1, datetime('now'))
              ON CONFLICT(user_id, repo_id) DO UPDATE SET
                is_starred = 1,
                starred_at = COALESCE(user_repos.starred_at, datetime('now'))`,
        args: [userId, repo.id],
      });
    }

    for (const repoId of removedIds) {
      statements.push({
        sql: `UPDATE user_repos
              SET is_starred = 0, starred_at = NULL
              WHERE user_id = ? AND repo_id = ?`,
        args: [userId, repoId],
      });
    }

    await db.batch(statements);

    const githubSync = username
      ? await syncGitHubLists(userId, username, buildRepoIdByFullName(freshRepos))
      : emptyGitHubListSync();

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

    let embedded = 0;
    if (added.length > 0) {
      try {
        const texts = added.map((r) =>
          buildRepoEmbeddingText({
            full_name: r.full_name,
            description: r.description,
            language: r.language,
            topics: r.topics,
          })
        );
        const embeddings = await generateEmbeddings(texts);
        const embStmts: InStatement[] = added.map((r, i) => ({
          sql: "INSERT OR REPLACE INTO repo_embeddings (repo_id, embedding, text_hash) VALUES (?, vector(?), ?)",
          args: [r.id, JSON.stringify(embeddings[i]), textHash(texts[i])],
        }));
        await db.batch(embStmts);
        embedded = added.length;
      } catch (error) {
        console.warn("Embedding generation failed:", error);
      }
    }

    return NextResponse.json({
      added: added.map((r) => ({ id: r.id, full_name: r.full_name, description: r.description })),
      removed: removedRepos,
      embedded,
      importedLists: githubSync.importedLists,
      assignedRepos: githubSync.assignedRepos,
      totalRepos: freshRepos.length,
      unchanged: added.length === 0 && removedIds.length === 0 && !githubSync.changed,
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

async function syncGitHubLists(
  userId: string,
  username: string,
  repoIdByFullName: Map<string, number>
): Promise<GitHubListSyncResult> {
  try {
    const githubLists = await fetchPublicStarLists(username);
    const existingListsResult = await db.execute({
      sql: `SELECT ul.id, ul.name, ul.description, ul.color, ul.position, COUNT(ur.repo_id) as repo_count
            FROM user_lists ul
            LEFT JOIN user_repo_lists url ON url.list_id = ul.id AND url.user_id = ul.user_id
            LEFT JOIN user_repos ur ON ur.user_id = url.user_id AND ur.repo_id = url.repo_id AND ur.is_starred = 1
            WHERE ul.user_id = ?
            GROUP BY ul.id
            ORDER BY ul.position ASC`,
      args: [userId],
    });
    const existingLists = existingListsResult.rows.map((row) => ({
      id: row.id as number,
      name: row.name as string,
      description: row.description as string | null,
      color: row.color as string,
      position: row.position as number,
      repoCount: row.repo_count as number,
    }));

    let changed = false;

    const bogusSortListIds = existingLists
      .filter((list) => list.repoCount === 0 && isBogusImportedSortList(list.name))
      .map((list) => list.id);

    if (bogusSortListIds.length > 0) {
      const placeholders = bogusSortListIds.map(() => "?").join(",");
      await db.execute({
        sql: `DELETE FROM user_lists WHERE user_id = ? AND id IN (${placeholders})`,
        args: [userId, ...bogusSortListIds],
      });
      changed = true;
    }

    if (githubLists.length === 0) {
      return { importedLists: [], assignedRepos: 0, changed };
    }

    const activeExistingLists = existingLists.filter((list) => !bogusSortListIds.includes(list.id));
    let nextPosition =
      activeExistingLists.reduce((max, list) => Math.max(max, list.position), -1) + 1;

    const importedLists: string[] = [];
    const matchedExistingIds = new Set<number>();
    const githubListIds = new Map<string, number>();

    for (const list of githubLists) {
      const existingMatch = activeExistingLists.find(
        (candidate) =>
          !matchedExistingIds.has(candidate.id) && matchesGitHubList(candidate.name, list)
      );

      if (existingMatch) {
        matchedExistingIds.add(existingMatch.id);
        githubListIds.set(list.slug, existingMatch.id);

        if (
          existingMatch.name !== list.name ||
          normalizeNullableText(existingMatch.description) !== normalizeNullableText(list.description)
        ) {
          await db.execute({
            sql: "UPDATE user_lists SET name = ?, description = ? WHERE id = ? AND user_id = ?",
            args: [list.name, list.description, existingMatch.id, userId],
          });
          importedLists.push(list.name);
          changed = true;
        }

        continue;
      }

      const insertResult = await db.execute({
        sql: "INSERT INTO user_lists (user_id, name, color, icon, position, description) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
        args: [userId, list.name, "#6366f1", null, nextPosition, list.description],
      });
      const listId = insertResult.rows[0]?.id as number | undefined;
      if (typeof listId === "number") {
        githubListIds.set(list.slug, listId);
      }
      importedLists.push(list.name);
      nextPosition++;
      changed = true;
    }

    const importedListIds = [...githubListIds.values()];
    if (importedListIds.length === 0) {
      return { importedLists, assignedRepos: 0, changed };
    }

    const desiredAssignments = new Set<string>();
    const desiredRepoIds = new Set<number>();

    for (const list of githubLists) {
      const listId = githubListIds.get(list.slug);
      if (!listId) {
        continue;
      }

      const repoFullNames = await fetchPublicStarListRepoNames(list.href);
      for (const fullName of repoFullNames) {
        const repoId = repoIdByFullName.get(normalizeRepoFullName(fullName));
        if (!repoId) {
          continue;
        }

        desiredAssignments.add(assignmentKey(repoId, listId));
        desiredRepoIds.add(repoId);
      }
    }

    const placeholders = importedListIds.map(() => "?").join(",");
    const currentAssignmentsResult = await db.execute({
      sql: `SELECT url.repo_id, url.list_id
            FROM user_repo_lists url
            JOIN user_repos ur ON ur.user_id = url.user_id AND ur.repo_id = url.repo_id AND ur.is_starred = 1
            WHERE url.user_id = ? AND url.list_id IN (${placeholders})`,
      args: [userId, ...importedListIds],
    });
    const currentAssignments = new Set(
      currentAssignmentsResult.rows.map((row) =>
        assignmentKey(row.repo_id as number, row.list_id as number)
      )
    );

    const missingAssignments = new Set(
      [...desiredAssignments].filter((assignment) => !currentAssignments.has(assignment))
    );

    if (missingAssignments.size > 0) {
      changed = true;

      const assignmentStatements: InStatement[] = [];
      for (const value of missingAssignments) {
        const [repoId, listId] = value.split(":").map(Number);
        assignmentStatements.push({
          sql: "INSERT OR IGNORE INTO user_repo_lists (user_id, repo_id, list_id) VALUES (?, ?, ?)",
          args: [userId, repoId, listId],
        });
      }
      await db.batch(assignmentStatements);
    }

    return {
      importedLists,
      assignedRepos: desiredRepoIds.size,
      changed,
    };
  } catch (error) {
    console.warn("GitHub list import skipped:", error);
    return emptyGitHubListSync();
  }
}

async function loadRepoIdsByFullName(userId: string): Promise<Map<string, number>> {
  const result = await db.execute({
    sql: `SELECT r.id, r.full_name
          FROM user_repos ur
          JOIN repos r ON r.id = ur.repo_id
          WHERE ur.user_id = ? AND ur.is_starred = 1`,
    args: [userId],
  });

  return new Map(
    result.rows.map((row) => [normalizeRepoFullName(row.full_name as string), row.id as number])
  );
}

function buildRepoIdByFullName(
  repos: Array<{ id: number; full_name: string }>
): Map<string, number> {
  return new Map(repos.map((repo) => [normalizeRepoFullName(repo.full_name), repo.id]));
}

function emptyGitHubListSync(): GitHubListSyncResult {
  return {
    importedLists: [],
    assignedRepos: 0,
    changed: false,
  };
}

function assignmentKey(repoId: number, listId: number): string {
  return `${repoId}:${listId}`;
}

function normalizeListName(name: string): string {
  return name.trim().toLowerCase();
}

function normalizeNullableText(value: string | null): string {
  return value?.trim() ?? "";
}

function normalizeRepoFullName(value: string): string {
  return value.trim().toLowerCase();
}

function isBogusImportedSortList(name: string): boolean {
  return BOGUS_IMPORTED_SORT_LISTS.has(normalizeListName(name));
}

function matchesGitHubList(existingName: string, githubList: GitHubStarList): boolean {
  const normalizedExistingName = normalizeListName(existingName);
  if (normalizedExistingName === normalizeListName(githubList.name)) {
    return true;
  }

  return buildLegacyImportedNames(githubList).some(
    (legacyName) => normalizedExistingName === normalizeListName(legacyName)
  );
}

function buildLegacyImportedNames(list: GitHubStarList): string[] {
  const names = new Set<string>();
  names.add(list.name);
  names.add(`${list.name} ${list.repoCount} repositories`);

  if (list.description) {
    names.add(`${list.name} ${list.description}`);
    names.add(`${list.name} ${list.description} ${list.repoCount} repositories`);
  }

  return [...names];
}
