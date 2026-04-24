# agents.md — starboard

## Purpose
GitHub stars organizer — sync, tag, and semantic vector search across your starred repositories.

## Stack
- Framework: Next.js 16 (App Router, React 19)
- Language: TypeScript
- Styling: Tailwind CSS v4 + shadcn/ui
- DB: Turso (libSQL) — raw SQL, NO ORM. Schema in `src/db/schema.sql` (6 tables, 7 indexes + vector index)
- Auth: NextAuth v5 beta (GitHub OAuth only — `read:user` scope)
- State: nuqs (URL state for filters), SWR (client data fetching)
- Testing: Vitest (unit in `src/__tests__/`)
- Deploy: Vercel
- Package manager: pnpm

## Repo structure
```
src/
  app/
    page.tsx              # Landing / redirect
    stars/                # Main dashboard (filter/sort/view logic)
    explore/[...slug]/    # Repo detail (comments, votes, likes)
    lists/[slug]/         # Public shared list page (SSR)
    api/
      auth/               # NextAuth
      stars/              # GET (filtered) + sync/route.ts (POST sync)
      lists/              # CRUD user lists
      repos/[repoId]/     # Tags, list assignment, likes, comments
  components/
    repo-card.tsx
    repo-grid.tsx         # Virtualized (@tanstack/react-virtual)
    sidebar.tsx           # Language/list/tag filter sidebar
    top-bar.tsx           # Search + sort controls
    tag-picker.tsx
    list-picker.tsx
  hooks/                  # SWR data hooks (use-starred-repos, use-lists, use-repo-tags)
  db/
    index.ts              # Turso client singleton
    schema.sql            # Full schema: 6 tables, 7 indexes + libsql_vector_idx
    migrate.ts            # Migration runner
    seed-embeddings.ts    # Backfill vector embeddings
  lib/
    github.ts             # Star sync (ETag caching)
    github-lists.ts       # GitHub star lists (HTML scraping)
    embeddings.ts         # Vector embedding generation
    auth.ts               # NextAuth config
docs/plans/               # Archived plans
```

## Key commands
```bash
pnpm dev                   # next dev (localhost:3000)
pnpm build                 # next build
pnpm test                  # vitest run
pnpm db:migrate            # npx tsx src/db/migrate.ts
pnpm db:seed-embeddings    # npx tsx src/db/seed-embeddings.ts
```

## Architecture notes
- **NO ORM** — raw SQL via `@libsql/client`. Schema in `src/db/schema.sql`. Apply with `db:migrate`.
- **Vector search**: `repo_embeddings` table stores `F32_BLOB(768)` with `libsql_vector_idx` cosine index. 768-dim embeddings for semantic search. Seed with `db:seed-embeddings`.
- **nuqs**: all filter/sort state in URL params — shareable links. Search, sort, language, list, tag params all via nuqs.
- **SWR**: all client data through SWR hooks. No React Query.
- **Tags stored as JSON arrays** in `user_repos.tags` text column.
- **ETag caching** for GitHub star sync — avoids redundant API calls.
- **GitHub star lists** via HTML scraping (not official API).
- **Facets**: language/list/tag counts computed server-side in `GET /api/stars`.
- **Virtualized grid** via `@tanstack/react-virtual`.
- **NextAuth v5 beta** (not v4 stable) — session shape differs. Access token stored for GitHub API sync.
- **SaaS Maker**: feedback widget, analytics, testimonials, changelog-widget integrated.
- Pre-push hook runs lint.

## Active context
