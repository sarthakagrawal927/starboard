# Explore Page + Shareable Lists Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a repo explore page (`/explore/[repoId]`) with comments and likes, and make user lists shareable via public URLs (`/lists/[slug]`).

**Architecture:** Schema changes merge `collections`/`collection_repos` into `user_lists` (add `is_public`, `slug`, `description`). New `comments` and `likes` tables for the explore page. Explore page fetches repo from our DB or GitHub API if not cached. Public list page is a server component that reads the list + its repos without auth.

**Tech Stack:** Next.js 16 App Router, Turso/libSQL, NextAuth, SWR, shadcn/ui, TailwindCSS v4

---

### Task 1: Schema migration — merge collections, add comments + likes

**Files:**
- Modify: `src/db/schema.sql`
- Modify: `src/db/migrate.ts`

**Step 1: Update schema.sql**

Add columns to `user_lists`:
```sql
ALTER TABLE user_lists ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_lists ADD COLUMN slug TEXT;
ALTER TABLE user_lists ADD COLUMN description TEXT;
```

Add new tables:
```sql
CREATE TABLE IF NOT EXISTS comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id     INTEGER NOT NULL,
  user_id     TEXT NOT NULL REFERENCES users(id),
  body        TEXT NOT NULL,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS likes (
  user_id     TEXT NOT NULL REFERENCES users(id),
  repo_id     INTEGER NOT NULL,
  created_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, repo_id)
);

CREATE INDEX IF NOT EXISTS idx_comments_repo ON comments(repo_id);
CREATE INDEX IF NOT EXISTS idx_likes_repo ON likes(repo_id);
CREATE INDEX IF NOT EXISTS idx_user_lists_slug ON user_lists(slug);
```

**Step 2: Update migrate.ts**

Add ALTERs (wrapped in try/catch for idempotency since SQLite ALTER is not IF NOT EXISTS). Drop `collections` and `collection_repos`.

```typescript
// Add new columns to user_lists (idempotent)
const alters = [
  "ALTER TABLE user_lists ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE user_lists ADD COLUMN slug TEXT",
  "ALTER TABLE user_lists ADD COLUMN description TEXT",
];
for (const sql of alters) {
  try { await db.execute(sql); } catch { /* column already exists */ }
}

// Drop old tables
await db.execute("DROP TABLE IF EXISTS collection_repos");
await db.execute("DROP TABLE IF EXISTS collections");
```

Then run the normal schema.sql statements (which will CREATE IF NOT EXISTS for comments, likes, and indexes).

**Step 3: Run migration**

```bash
set -a && source .env.local && set +a && npx tsx src/db/migrate.ts
```

**Step 4: Commit**

```
feat: schema — merge collections into user_lists, add comments + likes tables
```

---

### Task 2: Explore page API — repo detail, comments, likes

**Files:**
- Create: `src/app/api/repos/[repoId]/route.ts` (GET repo detail)
- Create: `src/app/api/repos/[repoId]/comments/route.ts` (GET/POST comments)
- Create: `src/app/api/repos/[repoId]/likes/route.ts` (GET/POST/DELETE likes)

**Step 1: GET /api/repos/[repoId]**

Returns repo data. If repo exists in our `repos` table, return it. If not, fetch from GitHub API (`https://api.github.com/repositories/[id]`), upsert into `repos`, and return. No auth required for GET (public data).

Response:
```json
{
  "repo": { "id": 123, "name": "...", "full_name": "...", ... },
  "likeCount": 5,
  "commentCount": 3,
  "userLiked": true
}
```

`userLiked` requires auth — if not logged in, return `false`.
`likeCount` and `commentCount` from COUNT queries.

**Step 2: GET/POST /api/repos/[repoId]/comments**

GET: Return all comments for repo, joined with users table for username/avatar. Ordered by created_at ASC. No auth required for reading.

```json
[
  {
    "id": 1,
    "body": "Great library!",
    "created_at": "2026-03-01T...",
    "user": { "id": "123", "username": "sarthak", "avatar_url": "..." }
  }
]
```

POST: Auth required. Create comment. Body: `{ body: string }`. Return created comment with user info.

**Step 3: GET/POST/DELETE /api/repos/[repoId]/likes**

GET: Return `{ count: number, userLiked: boolean }`. `userLiked` is false if not logged in.

POST: Auth required. Toggle like — if already liked, unlike (DELETE). If not liked, insert. Return new state.

Simplify: just POST as toggle.

**Step 4: Commit**

```
feat: explore API — repo detail, comments CRUD, like toggle
```

---

### Task 3: Explore page frontend

**Files:**
- Create: `src/app/explore/[repoId]/page.tsx`
- Create: `src/hooks/use-repo-detail.ts`

**Step 1: Create the hook**

```typescript
export function useRepoDetail(repoId: number) {
  // SWR fetch /api/repos/[repoId]
  // Returns { repo, likeCount, commentCount, userLiked, comments }
  // Separate SWR for comments (so we can mutate independently)
}
```

Two SWR keys:
- `/api/repos/${repoId}` — repo + like/comment counts
- `/api/repos/${repoId}/comments` — full comment list

Methods: `toggleLike()`, `addComment(body)`, `deleteComment(id)`.

**Step 2: Create the page**

Layout:
- **Header**: repo name, owner avatar, description, language, star count, link to GitHub
- **Stats bar**: like count + like button (heart icon), comment count
- **Topics**: chips for repo topics
- **Comments section**: list of comments with user avatar + username + body + timestamp
- **Comment input**: textarea + submit button (only if logged in, else "Sign in to comment")

Use existing shadcn components: Button, Avatar, Textarea, Separator, Card.

The page should work for non-logged-in users (view-only). Like button and comment form require auth (use `useSession` to gate).

**Step 3: Commit**

```
feat: explore page — repo detail with comments and likes
```

---

### Task 4: Shareable lists API

**Files:**
- Modify: `src/app/api/lists/[id]/route.ts` (add `is_public`, `slug`, `description` to PATCH)
- Create: `src/app/api/lists/[id]/share/route.ts` (POST toggle share)
- Create: `src/app/api/lists/public/[slug]/route.ts` (GET public list)

**Step 1: Update PATCH to support new fields**

Add `is_public`, `slug`, `description` to the dynamic update builder in the existing PATCH handler.

**Step 2: POST /api/lists/[id]/share**

Auth required. Toggles `is_public`. When making public:
- Generate slug from list name (lowercase, kebab-case, append short random suffix for uniqueness)
- Set `is_public = 1` and `slug = generated_slug`
- Return `{ is_public: true, slug: "my-list-a3f2", share_url: "/lists/my-list-a3f2" }`

When making private:
- Set `is_public = 0` (keep slug for re-sharing)
- Return `{ is_public: false }`

**Step 3: GET /api/lists/public/[slug]**

No auth required. Fetch list by slug where `is_public = 1`. Return list metadata + repos:

```json
{
  "list": { "id": 1, "name": "Favorites", "color": "#ef4444", "description": "..." },
  "owner": { "username": "sarthak", "avatar_url": "..." },
  "repos": [
    { "id": 123, "full_name": "...", "description": "...", ... }
  ]
}
```

**Step 4: Commit**

```
feat: shareable lists API — share toggle, public list endpoint
```

---

### Task 5: Shareable lists frontend

**Files:**
- Create: `src/app/lists/[slug]/page.tsx` (public page, server component)
- Modify: `src/components/sidebar.tsx` (add share button to lists)
- Modify: `src/hooks/use-lists.ts` (add shareList method)

**Step 1: Public list page**

Server component — fetch from `/api/lists/public/[slug]` at request time. No auth needed.

Layout:
- **Header**: list name (with color dot), description, owner avatar + username
- **Repo grid**: reuse RepoCard in read-only mode (no tag picker)
- **Footer**: "Powered by Starboard" link back to home

If list not found or not public, show 404.

**Step 2: Add share functionality to useLists hook**

```typescript
const shareList = async (id: number) => {
  const res = await fetch(`/api/lists/${id}/share`, { method: "POST" });
  const result = await res.json();
  mutate();
  return result;
};
```

**Step 3: Add share button to sidebar**

Next to each list in the sidebar, add a share icon button. On click:
- If not shared: call `shareList(id)`, show toast with share URL
- If shared: show share URL + option to unshare

Use a small popover or dialog. Keep it simple — just copy URL to clipboard.

**Step 4: Update UserList type**

Add `is_public`, `slug`, `description` fields to the `UserList` interface.

**Step 5: Commit**

```
feat: shareable lists UI — public page, share toggle in sidebar
```

---

### Task 6: Build, lint, deploy

**Step 1:** `pnpm lint && pnpm build` — fix any issues
**Step 2:** Push to main
**Step 3:** Run migration on prod: `set -a && source .env.local && set +a && npx tsx src/db/migrate.ts`
**Step 4:** `vercel --prod`
**Step 5:** Test explore page and shared lists in production
