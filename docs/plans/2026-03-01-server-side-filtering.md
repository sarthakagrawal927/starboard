# Server-Side Filtering + Virtualization Fix

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move all filtering, sorting, and pagination to the backend API so `/api/stars` only returns matching rows, reducing row reads and payload size.

**Architecture:** `/api/stars` accepts query params (`q`, `language`, `list_id`, `tag`, `sort`, `limit`, `offset`). Returns paginated results + facet counts (languages, lists, tags) in a single response. The client builds a SWR key from filter state — SWR dedupes and caches. Sidebar counts come from the API response, not computed client-side. Virtualization is fixed with ResizeObserver-based responsive columns (already done).

**Tech Stack:** Next.js API routes, Turso/libSQL, SWR with dynamic keys, @tanstack/react-virtual

---

### Task 1: Add indexes to schema for filter queries

**Files:**
- Modify: `src/db/schema.sql`
- Modify: `src/db/migrate.ts`

**Step 1: Add indexes to schema.sql**

Append after the `user_repos` table:

```sql
CREATE INDEX IF NOT EXISTS idx_user_repos_user ON user_repos(user_id);
CREATE INDEX IF NOT EXISTS idx_user_repos_list ON user_repos(user_id, list_id);
CREATE INDEX IF NOT EXISTS idx_repos_language ON repos(language);
```

**Step 2: Add indexes to migrate.ts**

Add the same CREATE INDEX statements to the migration script so they run on deploy.

**Step 3: Run migration locally**

```bash
set -a && source .env.local && set +a && npx tsx src/db/migrate.ts
```

**Step 4: Commit**

```bash
git add src/db/schema.sql src/db/migrate.ts
git commit -m "feat: add indexes for server-side filtering"
```

---

### Task 2: Rewrite `/api/stars` to accept filter query params

**Files:**
- Modify: `src/app/api/stars/route.ts`

**Step 1: Rewrite the GET handler**

Accept these query params:
- `q` — text search (LIKE on name, full_name, description, topics)
- `language` — exact match on repos.language (comma-separated for multi)
- `list_id` — exact match on user_repos.list_id
- `tag` — JSON contains check on user_repos.tags
- `sort` — one of: `starred` (default), `stars`, `updated`, `name`
- `limit` — page size, default 50, max 200
- `offset` — pagination offset, default 0

Build SQL dynamically with WHERE clauses + args array. Return:

```json
{
  "repos": [...],
  "total": 1234,
  "facets": {
    "languages": [["TypeScript", 42], ["Python", 31], ...],
    "lists": [[1, 15], [2, 8], ...],
    "tags": [["ml", 5], ["reading", 3], ...]
  }
}
```

The facets query runs a second SQL that counts across ALL user repos (ignoring current filters) so sidebar always shows global counts:

```sql
SELECT r.language, COUNT(*) as cnt
FROM user_repos ur JOIN repos r ON r.id = ur.repo_id
WHERE ur.user_id = ? AND r.language IS NOT NULL
GROUP BY r.language ORDER BY cnt DESC LIMIT 20
```

For tags facet, read all tags JSON and aggregate in JS (SQLite has no native JSON array iteration). For lists, join with user_lists to get name/color.

**Step 2: Verify with curl**

```bash
curl 'http://localhost:3000/api/stars?q=react&language=TypeScript&sort=stars&limit=10'
```

**Step 3: Commit**

```bash
git add src/app/api/stars/route.ts
git commit -m "feat: server-side filtering on /api/stars with facets"
```

---

### Task 3: Remove `/api/repo-tags` endpoint

**Files:**
- Delete: `src/app/api/repo-tags/route.ts`
- Modify: `src/hooks/use-repo-tags.ts`

Tags are now returned inline on each repo from `/api/stars` (the `tags` field on `user_repos`). The separate `/api/repo-tags` endpoint that fetches ALL tags for ALL repos is no longer needed.

**Step 1: Delete the endpoint**

Remove `src/app/api/repo-tags/route.ts`.

**Step 2: Simplify use-repo-tags.ts**

The hook no longer fetches from an API. Instead, it derives the tag map from the repos data passed to it (or we can remove this hook entirely and let the page derive it). Keep the mutation methods (addTag, removeTag, setTags) which still call `PUT /api/repos/[repoId]/tags`.

Rewrite to accept repos as input and derive the map:

```typescript
export function useRepoTags(repos: UserRepo[]) {
  const repoTagMap = useMemo(() => {
    const map: Record<number, string[]> = {};
    for (const repo of repos) {
      if (repo.tags.length > 0) map[repo.id] = repo.tags;
    }
    return map;
  }, [repos]);
  // ... keep setTags/addTag/removeTag methods, they mutate via API + revalidate parent
}
```

The mutation methods should call the parent SWR `mutate` to revalidate `/api/stars` after tag changes.

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: derive tag map from repos, remove /api/repo-tags"
```

---

### Task 4: Rewrite `useStarredRepos` hook for server-side filtering

**Files:**
- Modify: `src/hooks/use-starred-repos.ts`

**Step 1: Accept filter params, build SWR key from them**

```typescript
interface UseStarredReposOptions {
  q?: string;
  language?: string[];
  listId?: number | null;
  tag?: string | null;
  sort?: SortOption;
  limit?: number;
  offset?: number;
}
```

Build the SWR key as a URL with query params:

```typescript
function buildStarsUrl(opts: UseStarredReposOptions): string {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.language?.length) params.set("language", opts.language.join(","));
  if (opts.listId != null) params.set("list_id", String(opts.listId));
  if (opts.tag) params.set("tag", opts.tag);
  if (opts.sort && opts.sort !== "recently-starred") params.set("sort", opts.sort);
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.offset) params.set("offset", String(opts.offset));
  const qs = params.toString();
  return `/api/stars${qs ? `?${qs}` : ""}`;
}
```

Update the response type to include `total` and `facets`.

**Step 2: Add debounced search**

The `q` param should only update the SWR key after 300ms of no typing. Use a `debouncedQ` state inside the hook (or let the page handle it — cleaner if the page debounces before passing to the hook).

Decision: page handles debounce. Hook takes final values.

**Step 3: Commit**

```bash
git add src/hooks/use-starred-repos.ts
git commit -m "feat: useStarredRepos accepts filter params, builds SWR key"
```

---

### Task 5: Rewrite `page.tsx` to use server-side filters

**Files:**
- Modify: `src/app/stars/page.tsx`

**Step 1: Remove client-side filtering logic**

Delete the entire `filteredRepos` useMemo block (lines ~134-191). The API now returns pre-filtered, pre-sorted results.

**Step 2: Wire filter state into useStarredRepos**

```typescript
const [debouncedSearch, setDebouncedSearch] = useState("");

// Debounce search input
useEffect(() => {
  const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
  return () => clearTimeout(t);
}, [searchQuery]);

const {
  repos, total, facets, isLoading, syncing, sync, ...
} = useStarredRepos({
  q: debouncedSearch,
  language: selectedLanguages,
  listId: selectedListId,
  tag: selectedTag,
  sort: sortBy,
});
```

**Step 3: Remove allTags/languageCounts derivation from page**

The `allTags` useMemo and sidebar `languageCounts` now come from `facets` returned by the API.

**Step 4: Update Sidebar props**

Pass `facets.languages`, `facets.lists`, `facets.tags` instead of raw repos.

**Step 5: Commit**

```bash
git add src/app/stars/page.tsx
git commit -m "feat: page uses server-side filters, removes client-side filtering"
```

---

### Task 6: Update Sidebar to use facet counts from API

**Files:**
- Modify: `src/components/sidebar.tsx`

**Step 1: Change props to accept facets**

Replace `repos: UserRepo[]` prop with:

```typescript
interface SidebarProps {
  languageFacets: [string, number][];
  listFacets: [number, number][]; // [list_id, count]
  tagFacets: [string, number][];
  // ... keep the rest
}
```

**Step 2: Remove client-side languageCounts and listCounts useMemos**

These are now pre-computed by the API.

**Step 3: Render from facets**

Languages section maps over `languageFacets`. Tags section maps over `tagFacets`. List counts come from `listFacets`.

**Step 4: Commit**

```bash
git add src/components/sidebar.tsx
git commit -m "refactor: sidebar uses API facet counts"
```

---

### Task 7: Add pagination controls

**Files:**
- Modify: `src/app/stars/page.tsx`
- Modify: `src/components/repo-grid.tsx`

**Step 1: Add offset state to page**

```typescript
const [offset, setOffset] = useState(0);
// Reset offset when filters change
useEffect(() => setOffset(0), [debouncedSearch, selectedLanguages, selectedListId, selectedTag, sortBy]);
```

Pass `offset` and `limit=50` to `useStarredRepos`.

**Step 2: Add pagination UI at bottom of RepoGrid**

Show "Showing 1-50 of 1234" + Previous/Next buttons. Use `total` from API response.

```tsx
{total > limit && (
  <div className="flex items-center justify-between border-t pt-4">
    <span className="text-sm text-muted-foreground">
      {offset + 1}-{Math.min(offset + limit, total)} of {total}
    </span>
    <div className="flex gap-2">
      <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => setOffset(o => o - limit)}>Previous</Button>
      <Button size="sm" variant="outline" disabled={offset + limit >= total} onClick={() => setOffset(o => o + limit)}>Next</Button>
    </div>
  </div>
)}
```

**Step 3: Commit**

```bash
git add src/app/stars/page.tsx src/components/repo-grid.tsx
git commit -m "feat: add pagination controls"
```

---

### Task 8: Build, lint, deploy

**Files:** None (verification only)

**Step 1: Lint + build**

```bash
pnpm lint && pnpm build
```

Fix any issues.

**Step 2: Commit fixes if any**

**Step 3: Push and deploy**

```bash
git push origin main
vercel --prod
```

**Step 4: Test in production**

- Open mystarboard.vercel.app
- Hit Sync
- Test search, language filter, list filter, tag filter, sort, pagination
- Verify sidebar counts update correctly
