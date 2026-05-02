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

<!-- FLEET-GUIDANCE:START -->

## Fleet Guidance

### Adding Tasks
- Add durable work items in SaaS Maker Cockpit Tasks when the task affects product behavior, deployment, user feedback, or fleet maintenance.
- Include the project slug, a concise title, acceptance criteria, priority/status, and links to relevant code, issues, traces, or dashboards.
- If task discovery starts locally in an editor or agent session, mirror the durable next step back into SaaS Maker before handoff.

### Using SaaS Maker
- Treat SaaS Maker as the system of record for project metadata, feedback, tasks, analytics, testimonials, changelog, and fleet visibility.
- Prefer API-first workflows through `fnd api`, the SDK, or widgets instead of one-off scripts when interacting with SaaS Maker features.
- Keep this agent file aligned with the project record when operating rules, integrations, or deployment conventions change.

### Free AI First
- Prefer free/local AI paths for routine development and analysis: the `free-ai` gateway, local models, provider free tiers, and cached context.
- Escalate to paid models only when complexity, correctness risk, or missing capability justifies the cost.
- Note any paid-AI use in the task or handoff when it materially affects cost, reproducibility, or future maintenance.

<!-- FLEET-GUIDANCE:END -->

## Active context


<claude-mem-context>
# Memory Context

# [starboard] recent context, 2026-05-02 2:45pm GMT+5:30

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (15,799t read) | 283,794t work | 94% savings

### Apr 25, 2026
58 5:48a 🔵 Starboard test suite: 5 pass, 9 skip after all search improvements
59 " 🔵 Pre-existing ESLint circular structure crash in starboard
60 5:50a 🔵 Starboard test suite structure — 2 test files in src/__tests__
61 " 🔵 search-integration.test.ts semantic relevance tests use live Turso vector search
62 5:51a 🔄 RRF fusion extracted to src/lib/search.ts utility
63 " 🟣 New search.test.ts added — unit tests for rrfFuse and cosineSimilarity
64 " ✅ Vitest suite grows from 5 to 16 passing tests after search.test.ts added
65 " 🟣 search-integration.test.ts extended with similar-repos and lexical NOCASE integration tests
66 5:52a 🔴 vitest.config.ts double-comma syntax error breaks vitest startup
S39 Add tests for new starboard search code — rrfFuse, cosineSimilarity, and similar-repos integration (Apr 25 at 5:52 AM)
S42 Global search / discovery feature design — extending AI search beyond user's own starred repos to a public discovery feed (Apr 25 at 5:52 AM)
S43 External repo sourcing strategy for Starboard AI search — planning discussion on expanding beyond user-starred repos (Apr 25 at 5:54 AM)
S44 Starboard sync architecture investigation + GH Search proxy design for discover page enrichment (Apr 25 at 5:55 AM)
S45 Daily GitHub Action planned for incremental popular-repo embedding seeding (Apr 25 at 5:56 AM)
67 5:59a ⚖️ Daily GitHub Action planned for incremental popular-repo embedding seeding
S46 Design cold-seed strategy for Starboard repo embeddings with MIN_STARS_FLOOR=5000 threshold (Apr 25 at 5:59 AM)
S54 Implement daily GH Action to cold-seed popular repos (≥5k stars) into Starboard's Turso DB with embeddings (Apr 25 at 5:59 AM)
68 6:00a 🟣 seed_cursor table added to Starboard schema
69 6:01a 🔵 Existing seed-embeddings.ts pattern for Starboard embedding pipeline
70 " 🟣 scripts/seed-popular.ts — two-phase GH repo cold-seeder implemented
71 6:02a ⚖️ seed-popular.ts redesigned: unified walk replaces two-phase cold_seed/maintenance split
72 6:03a 🔄 seed-popular.ts: runColdSeed + runMaintenance collapsed into single walkAndUpsert()
73 " ✅ seed_cursor schema: phase column removed, comment updated
74 " 🟣 GitHub Actions workflow seed-popular.yml created for daily repo seeding
75 6:04a ✅ seed:popular npm script added; workflow uses script alias
76 " 🔵 migrate.ts applies schema.sql wholesale — seed_cursor table lands via existing migration path
S58 Daily GH Action to cold-seed popular repos (≥5k stars) into Starboard Turso DB — full implementation complete and ready to ship (Apr 25 at 6:04 AM)
77 6:05a ✅ GH search inter-page delay increased from 1500ms to 2100ms
S59 Starboard migration feasibility: Next.js app on Cloudflare Workers via @opennextjs/cloudflare (Apr 25 at 6:05 AM)
78 6:09a ⚖️ Starboard database migration decision — Turso → Cloudflare D1
79 6:10a 🟣 Starboard CF migration — opennext + wrangler installed
81 " 🟣 Starboard wrangler.jsonc + open-next.config.ts created for CF deployment
82 " 🔄 embeddings.ts — dual-path AI: Workers binding + HTTP gateway fallback
83 6:11a 🔄 generateEmbeddings() wired to dual-path adapter — CF binding preferred, HTTP fallback
84 " ✅ Starboard package.json — CF build/deploy/preview/typegen scripts added
85 6:12a ✅ next.config.ts — opennext dev init wired for local CF binding access
86 " 🟣 cloudflare-env.d.ts generated — full CF binding types for Starboard
87 6:13a 🔵 Starboard CF build fails — missing component files block next build
89 " 🟣 Starboard CF build succeeds — opennext bundle ready for Workers deploy
90 6:14a ✅ .gitignore updated — CF build artifacts and generated types excluded
91 " 🔵 Starboard post-CF-migration state — tsc deprecation warning, all tests pass
92 " 🔴 tsconfig.json — deprecated baseUrl removed, tsc now clean
S69 Starboard — migrate deployment from Vercel/Turso to Cloudflare Workers via opennextjs-cloudflare (Apr 25 at 6:14 AM)
93 6:17a 🔵 Starboard prod env vars discovered via Vercel pull
94 6:18a ✅ Starboard CF Worker secrets configured via wrangler bulk push
95 6:19a 🔴 Starboard Turso schema migration fixed — tsx not found via --import flag
96 6:20a 🟣 Starboard deployed to Cloudflare Workers — live at workers.dev URL
97 " 🔵 Starboard Worker 500s traced to OpenNext layer, not CF runtime
99 6:23a 🔵 wrangler tail produces empty output for deployed Starboard Worker
103 6:26a 🔴 Starboard db/index.ts switched to @libsql/client/web for CF Workers compatibility
106 6:28a 🔵 Starboard CF Worker: static assets serve 200, only dynamic routes return 500
107 6:29a 🔵 wrangler tail connects but Worker emits zero log events on 500
108 " 🔵 Root cause found: @libsql/client not bundled in CF Workers — module resolution fails at runtime
112 " 🔵 @libsql/client package.json has workerd condition but OpenNext doesn't honor it
113 6:30a ✅ Starboard db/index.ts reverted to @libsql/client — relying on workerd export condition
115 " 🔵 OpenNext cloudflare config has useWorkerdCondition option — defaults to true
117 " 🔴 next.config.ts adds transpilePackages for @libsql/client to force Worker bundle inclusion
118 6:31a 🔵 transpilePackages had no effect — OpenNext bundles @libsql/client externally regardless of Next.js config
121 6:32a ✅ package.json CF scripts changed to force webpack build then skipNextBuild
122 " 🔵 webpack build fails — libsql pulls in native sqlite3 binaries incompatible with webpack

Access 284k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
