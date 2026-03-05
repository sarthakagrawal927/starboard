# Database Schema Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the JSON-blob `stars_cache` schema with properly normalized tables (`repos`, `user_repos`, `user_lists`) and swap hardcoded categories for user-created lists.

**Architecture:** Shared `repos` table (one row per GitHub repo), `user_repos` join table (per-user starred relationship with tags as JSON array and nullable list FK), `user_lists` for user-created folders that replace hardcoded keyword categories. All filtering/sorting happens at the DB level via JOINs instead of client-side JSON parsing.

**Tech Stack:** Turso (libSQL) via `@libsql/client`, Next.js 16 API routes, SWR for client data fetching.

---

### Task 1: New Schema + Migration

**Files:**
- Modify: `src/db/schema.sql`
- Modify: `src/db/migrate.ts`

**Step 1: Replace schema.sql with new schema**

```sql
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  username    TEXT NOT NULL,
  avatar_url  TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS repos (
  id               INTEGER PRIMARY KEY,
  name             TEXT NOT NULL,
  full_name        TEXT NOT NULL,
  owner_login      TEXT NOT NULL,
  owner_avatar     TEXT NOT NULL,
  html_url         TEXT NOT NULL,
  description      TEXT,
  language         TEXT,
  stargazers_count INTEGER NOT NULL DEFAULT 0,
  topics           TEXT NOT NULL DEFAULT '[]',
  repo_created_at  TEXT,
  repo_updated_at  TEXT
);

CREATE TABLE IF NOT EXISTS user_lists (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users(id),
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#6366f1',
  icon        TEXT,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_repos (
  user_id     TEXT NOT NULL REFERENCES users(id),
  repo_id     INTEGER NOT NULL REFERENCES repos(id),
  list_id     INTEGER REFERENCES user_lists(id) ON DELETE SET NULL,
  tags        TEXT NOT NULL DEFAULT '[]',
  notes       TEXT,
  starred_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, repo_id)
);
```

**Step 2: Update migrate.ts to drop old tables first, then create new**

The migration script should drop old tables (`stars_cache`, `tags`, `repo_tags`) and create the new ones. Since this is a fresh redesign and there's no production data to preserve, a clean drop+create is fine.

```typescript
import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { join } from "path";

async function migrate() {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  // Drop old tables
  await db.execute("DROP TABLE IF EXISTS repo_tags");
  await db.execute("DROP TABLE IF EXISTS tags");
  await db.execute("DROP TABLE IF EXISTS stars_cache");

  // Create new schema
  const schema = readFileSync(join(__dirname, "schema.sql"), "utf-8");
  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await db.execute(statement);
  }

  console.log("Migration complete");
  process.exit(0);
}

migrate().catch(console.error);
```

**Step 3: Run migration**

```bash
pnpm db:migrate
```

Expected: "Migration complete"

**Step 4: Commit**

```bash
git add src/db/schema.sql src/db/migrate.ts
git commit -m "feat: new normalized schema — repos, user_repos, user_lists"
```

---

### Task 2: Update Sync API (the core data flow)

**Files:**
- Modify: `src/app/api/stars/sync/route.ts`
- Modify: `src/lib/github.ts` (add helper type for DB mapping)

**Step 1: Update sync route to upsert into `repos` + `user_repos`**

The sync route fetches from GitHub, then:
1. Upserts each repo into `repos` table
2. Diffs against `user_repos` for this user
3. Inserts new user_repos, deletes removed ones
4. Returns diff summary

```typescript
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { fetchAllStarredRepos, StarredRepo } from "@/lib/github";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();

  if (!session?.accessToken || !session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.githubId;

  try {
    const result = await fetchAllStarredRepos(session.accessToken);

    if (result.notModified) {
      return NextResponse.json({ added: [], removed: [], unchanged: true });
    }

    const freshRepos = result.repos;
    const freshIds = new Set(freshRepos.map((r) => r.id));

    // Load current user_repos
    const existing = await db.execute({
      sql: "SELECT repo_id FROM user_repos WHERE user_id = ?",
      args: [userId],
    });
    const existingIds = new Set(existing.rows.map((r) => r.repo_id as number));

    // Determine added and removed
    const added = freshRepos.filter((r) => !existingIds.has(r.id));
    const removedIds = [...existingIds].filter((id) => !freshIds.has(id));

    // Batch upsert repos + insert user_repos for new stars
    for (const repo of freshRepos) {
      await db.execute({
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
          repo.id,
          repo.name,
          repo.full_name,
          repo.owner.login,
          repo.owner.avatar_url,
          repo.html_url,
          repo.description,
          repo.language,
          repo.stargazers_count,
          JSON.stringify(repo.topics),
          repo.created_at,
          repo.updated_at,
        ],
      });
    }

    // Insert new user_repos
    for (const repo of added) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO user_repos (user_id, repo_id) VALUES (?, ?)`,
        args: [userId, repo.id],
      });
    }

    // Remove unstarred repos
    if (removedIds.length > 0) {
      for (const repoId of removedIds) {
        await db.execute({
          sql: "DELETE FROM user_repos WHERE user_id = ? AND repo_id = ?",
          args: [userId, repoId],
        });
      }
    }

    // Get removed repo info for the response
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
      totalRepos: freshRepos.length,
      unchanged: added.length === 0 && removedIds.length === 0,
    });
  } catch (error) {
    console.error("Sync failed:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/stars/sync/route.ts
git commit -m "feat: sync route upserts into repos + user_repos tables"
```

---

### Task 3: Update Stars Read API

**Files:**
- Modify: `src/app/api/stars/route.ts`

**Step 1: Rewrite GET to JOIN repos + user_repos**

```typescript
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
      // User-specific fields
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
```

**Step 2: Commit**

```bash
git add src/app/api/stars/route.ts
git commit -m "feat: stars GET reads from repos + user_repos JOIN"
```

---

### Task 4: Lists CRUD API

**Files:**
- Create: `src/app/api/lists/route.ts`
- Create: `src/app/api/lists/[id]/route.ts`

**Step 1: Create lists route (GET all + POST create)**

```typescript
// src/app/api/lists/route.ts
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await db.execute({
    sql: "SELECT * FROM user_lists WHERE user_id = ? ORDER BY position ASC",
    args: [session.user.githubId],
  });

  return NextResponse.json(result.rows);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, color, icon } = await request.json();
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // Get next position
  const posResult = await db.execute({
    sql: "SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM user_lists WHERE user_id = ?",
    args: [session.user.githubId],
  });
  const nextPos = posResult.rows[0].next_pos as number;

  const result = await db.execute({
    sql: "INSERT INTO user_lists (user_id, name, color, icon, position) VALUES (?, ?, ?, ?, ?) RETURNING *",
    args: [session.user.githubId, name.trim(), color || "#6366f1", icon || null, nextPos],
  });

  return NextResponse.json(result.rows[0], { status: 201 });
}
```

**Step 2: Create lists/[id] route (PATCH + DELETE)**

```typescript
// src/app/api/lists/[id]/route.ts
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const listId = parseInt(id, 10);
  if (isNaN(listId)) {
    return NextResponse.json({ error: "Invalid list id" }, { status: 400 });
  }

  const body = await request.json();
  const updates: string[] = [];
  const args: unknown[] = [];

  if (body.name !== undefined) { updates.push("name = ?"); args.push(body.name); }
  if (body.color !== undefined) { updates.push("color = ?"); args.push(body.color); }
  if (body.icon !== undefined) { updates.push("icon = ?"); args.push(body.icon); }
  if (body.position !== undefined) { updates.push("position = ?"); args.push(body.position); }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  args.push(listId, session.user.githubId);
  const result = await db.execute({
    sql: `UPDATE user_lists SET ${updates.join(", ")} WHERE id = ? AND user_id = ? RETURNING *`,
    args,
  });

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  return NextResponse.json(result.rows[0]);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const listId = parseInt(id, 10);
  if (isNaN(listId)) {
    return NextResponse.json({ error: "Invalid list id" }, { status: 400 });
  }

  await db.execute({
    sql: "DELETE FROM user_lists WHERE id = ? AND user_id = ?",
    args: [listId, session.user.githubId],
  });

  return NextResponse.json({ success: true });
}
```

**Step 3: Commit**

```bash
git add src/app/api/lists/
git commit -m "feat: lists CRUD API — GET, POST, PATCH, DELETE"
```

---

### Task 5: Tags API (simplified for JSON array)

**Files:**
- Modify: `src/app/api/repos/[repoId]/tags/route.ts` — update to PATCH user_repos.tags JSON
- Delete: `src/app/api/tags/route.ts` — no longer needed (tags are freeform strings)
- Delete: `src/app/api/tags/[id]/route.ts` — no longer needed
- Modify: `src/app/api/repo-tags/route.ts` — read tags from user_repos

**Step 1: Rewrite repos/[repoId]/tags to update JSON array on user_repos**

```typescript
// src/app/api/repos/[repoId]/tags/route.ts
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { NextRequest, NextResponse } from "next/server";

// GET tags for a specific repo
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const session = await auth();
  if (!session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { repoId } = await params;
  const result = await db.execute({
    sql: "SELECT tags FROM user_repos WHERE user_id = ? AND repo_id = ?",
    args: [session.user.githubId, parseInt(repoId, 10)],
  });

  if (result.rows.length === 0) {
    return NextResponse.json([]);
  }

  return NextResponse.json(JSON.parse(result.rows[0].tags as string));
}

// PUT: replace entire tags array
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const session = await auth();
  if (!session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { repoId } = await params;
  const { tags } = await request.json();

  if (!Array.isArray(tags) || !tags.every((t: unknown) => typeof t === "string")) {
    return NextResponse.json({ error: "tags must be an array of strings" }, { status: 400 });
  }

  await db.execute({
    sql: "UPDATE user_repos SET tags = ? WHERE user_id = ? AND repo_id = ?",
    args: [JSON.stringify(tags), session.user.githubId, parseInt(repoId, 10)],
  });

  return NextResponse.json({ tags });
}
```

**Step 2: Update repo-tags bulk endpoint to read from user_repos**

```typescript
// src/app/api/repo-tags/route.ts
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
```

**Step 3: Delete old tag routes**

Delete `src/app/api/tags/route.ts` and `src/app/api/tags/[id]/route.ts`.

**Step 4: Commit**

```bash
git add src/app/api/repos/[repoId]/tags/route.ts src/app/api/repo-tags/route.ts
git rm src/app/api/tags/route.ts src/app/api/tags/[id]/route.ts
git commit -m "feat: tags are now JSON string arrays on user_repos"
```

---

### Task 6: Repo List Assignment API

**Files:**
- Create: `src/app/api/repos/[repoId]/list/route.ts`

**Step 1: Create endpoint to assign/remove a repo from a list**

```typescript
// src/app/api/repos/[repoId]/list/route.ts
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { NextRequest, NextResponse } from "next/server";

// PUT: assign repo to a list (or null to remove)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const session = await auth();
  if (!session?.user?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { repoId } = await params;
  const { listId } = await request.json();

  await db.execute({
    sql: "UPDATE user_repos SET list_id = ? WHERE user_id = ? AND repo_id = ?",
    args: [listId ?? null, session.user.githubId, parseInt(repoId, 10)],
  });

  return NextResponse.json({ success: true });
}
```

**Step 2: Commit**

```bash
git add src/app/api/repos/[repoId]/list/route.ts
git commit -m "feat: API to assign repo to a list"
```

---

### Task 7: Client Hooks

**Files:**
- Modify: `src/hooks/use-starred-repos.ts` — update response type to include list_id, tags, notes
- Modify: `src/hooks/use-repo-tags.ts` — tags are now string arrays, not number IDs
- Delete: `src/hooks/use-tags.ts` — no longer needed
- Create: `src/hooks/use-lists.ts` — CRUD for user_lists

**Step 1: Update use-starred-repos to match new API shape**

The response now includes `list_id`, `tags` (string[]), `notes` on each repo. The `StarredRepo` type from `github.ts` is still used for the GitHub API fetch — create an extended type for the DB response.

```typescript
// src/hooks/use-starred-repos.ts
"use client";

import { useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface UserRepo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string; avatar_url: string };
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  topics: string[];
  created_at: string;
  updated_at: string;
  list_id: number | null;
  tags: string[];
  notes: string | null;
  starred_at: string;
}

interface StarsResponse {
  repos: UserRepo[];
  fetchedAt: string | null;
}

export interface SyncResult {
  added: { id: number; full_name: string; description: string | null }[];
  removed: { id: number; full_name: string; description: string | null }[];
  totalRepos: number;
  unchanged: boolean;
}

export function useStarredRepos() {
  const { data, error, isLoading, mutate } = useSWR<StarsResponse>("/api/stars", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000 * 5,
  });

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const sync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/stars/sync", { method: "POST" });
      const result: SyncResult = await res.json();
      setSyncResult(result);
      mutate();
      return result;
    } finally {
      setSyncing(false);
    }
  };

  const dismissSyncResult = () => setSyncResult(null);

  return {
    repos: data?.repos ?? [],
    fetchedAt: data?.fetchedAt ?? null,
    error,
    isLoading,
    syncing,
    sync,
    syncResult,
    dismissSyncResult,
    mutate,
  };
}
```

**Step 2: Rewrite use-repo-tags for string tags**

```typescript
// src/hooks/use-repo-tags.ts
"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useRepoTags() {
  const { data, error, isLoading, mutate } = useSWR<Record<number, string[]>>(
    "/api/repo-tags",
    fetcher
  );

  const setTags = async (repoId: number, tags: string[]) => {
    // Optimistic update
    mutate(
      (prev) => ({ ...prev, [repoId]: tags }),
      false
    );
    await fetch(`/api/repos/${repoId}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    });
    mutate();
  };

  const addTag = async (repoId: number, tag: string) => {
    const current = data?.[repoId] ?? [];
    if (!current.includes(tag)) {
      await setTags(repoId, [...current, tag]);
    }
  };

  const removeTag = async (repoId: number, tag: string) => {
    const current = data?.[repoId] ?? [];
    await setTags(repoId, current.filter((t) => t !== tag));
  };

  const getTagsForRepo = (repoId: number): string[] => {
    return data?.[repoId] ?? [];
  };

  return { repoTagMap: data ?? {}, error, isLoading, setTags, addTag, removeTag, getTagsForRepo, mutate };
}
```

**Step 3: Create use-lists hook**

```typescript
// src/hooks/use-lists.ts
"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface UserList {
  id: number;
  user_id: string;
  name: string;
  color: string;
  icon: string | null;
  position: number;
  created_at: string;
}

export function useLists() {
  const { data, error, isLoading, mutate } = useSWR<UserList[]>("/api/lists", fetcher);

  const createList = async (name: string, color?: string) => {
    const res = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    const list = await res.json();
    mutate();
    return list;
  };

  const updateList = async (id: number, updates: Partial<Pick<UserList, "name" | "color" | "icon" | "position">>) => {
    await fetch(`/api/lists/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    mutate();
  };

  const deleteList = async (id: number) => {
    await fetch(`/api/lists/${id}`, { method: "DELETE" });
    mutate();
  };

  const assignRepoToList = async (repoId: number, listId: number | null) => {
    await fetch(`/api/repos/${repoId}/list`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listId }),
    });
  };

  return { lists: data ?? [], error, isLoading, createList, updateList, deleteList, assignRepoToList, mutate };
}
```

**Step 4: Delete use-tags.ts**

Delete `src/hooks/use-tags.ts`.

**Step 5: Commit**

```bash
git add src/hooks/use-starred-repos.ts src/hooks/use-repo-tags.ts src/hooks/use-lists.ts
git rm src/hooks/use-tags.ts
git commit -m "feat: client hooks for new schema — lists, string tags"
```

---

### Task 8: Update Frontend Components

**Files:**
- Modify: `src/app/stars/page.tsx` — wire up lists instead of categories, update tag types
- Modify: `src/components/sidebar.tsx` — replace categories section with lists, update tags to string-based
- Modify: `src/components/repo-card.tsx` — tags are now strings not objects
- Modify: `src/components/repo-grid.tsx` — update tag prop types
- Modify: `src/components/tag-picker.tsx` — update for string tags (freeform input)
- Delete: `src/lib/categories.ts`
- Delete: `src/components/create-tag-dialog.tsx` — no longer needed (tags are inline freeform)

This is the largest task. The key changes:

1. **sidebar.tsx**: Replace the "Categories" section with "Lists" section using `useLists()`. Lists are user-created, shown with color dots, clickable to filter. Tags section becomes a display of all unique tags across repos (derived from repo data).

2. **repo-card.tsx**: Tags are now `string[]` instead of `Tag[]` objects. Remove `allTags`, `assignedTagIds`, `onAssignTag`, `onRemoveTag` props. Replace with `tags: string[]` display-only. The tag picker becomes a freeform string input.

3. **repo-grid.tsx**: Update prop types to match — `repoTagMap` becomes `Record<number, string[]>` (already is), remove `Tag` interface.

4. **stars/page.tsx**: Remove `useTags()`, add `useLists()`. Replace `selectedCategory` with `selectedListId`. Filter by `list_id` on the repo instead of keyword matching. Keep tag filtering but against string arrays.

5. **tag-picker.tsx**: Convert from checkbox-style tag assignment (pick from existing tags) to a freeform input where users type tag names. Show existing tags as suggestions.

**Step 1: Update sidebar.tsx**

Replace the Categories section with Lists. Replace the Tags section to show unique tags derived from repos. Add a "New List" button instead of "New Tag".

Key changes:
- Remove `categories` import and `categorizeRepos`
- Add `lists: UserList[]`, `selectedListId: number | null`, `onListSelect`, `onCreateList` props
- Replace `selectedCategory`/`onCategorySelect` with list equivalents
- Tags section shows unique tags from all repos (passed as `allTags: string[]`)
- Remove `CreateTagDialog` — replace with a simple list creation dialog

**Step 2: Update repo-card.tsx**

- Change `tags` prop from `Tag[]` to `string[]`
- Remove `allTags`, `assignedTagIds` props
- Tags render as simple badges with a default color
- Tag picker props change to string-based

**Step 3: Update repo-grid.tsx**

- Remove `Tag` interface
- Update types to use string tags

**Step 4: Update stars/page.tsx**

- Remove `useTags()`, `useRepoTags()` (tags now come from the repos themselves)
- Add `useLists()`
- Replace category filter with list filter (filter by `repo.list_id`)
- Tag filter works on `repo.tags` string array
- Derive `allTags` from all repos' tags for sidebar display

**Step 5: Update tag-picker.tsx**

- Convert to freeform string input
- Show suggestions from existing tags across all repos
- Add/remove tags as strings

**Step 6: Delete old files**

```bash
git rm src/lib/categories.ts src/components/create-tag-dialog.tsx
```

**Step 7: Commit**

```bash
git add src/app/stars/page.tsx src/components/sidebar.tsx src/components/repo-card.tsx src/components/repo-grid.tsx src/components/tag-picker.tsx
git commit -m "feat: frontend wired to new schema — lists replace categories, string tags"
```

---

### Task 9: Verify + Clean Up

**Step 1: Run the dev server and verify**

```bash
pnpm dev
```

Test manually:
- Login flow still works
- Sync fetches repos and populates `repos` + `user_repos` tables
- Stars page loads repos from the new JOIN query
- Creating a list works, shows in sidebar
- Clicking a list filters repos by `list_id`
- Tag picker adds/removes string tags on repos
- Tag filter in sidebar works

**Step 2: Run lint**

```bash
pnpm lint
```

Fix any errors.

**Step 3: Run build**

```bash
pnpm build
```

Fix any type errors.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: lint and build fixes for schema migration"
```
