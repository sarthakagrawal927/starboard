# Starboard

GitHub stars organizer -- sign in with GitHub, sync your starred repos, filter/search/tag/list them.

Live: https://mystarboard.vercel.app

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19, React Compiler enabled)
- **Styling**: Tailwind CSS v4 + shadcn/ui (new-york style, Radix primitives, Lucide icons)
- **Auth**: NextAuth v5 (GitHub OAuth, `read:user` scope)
- **Database**: Turso (libSQL via `@libsql/client`) -- raw SQL, no ORM
- **Data fetching**: SWR (client), `fetch` (server)
- **URL state**: nuqs (search, sort, language, list, tag params)
- **Virtualization**: @tanstack/react-virtual
- **Command palette**: cmdk
- **Analytics/Feedback**: SaaS Maker SDK (feedback widget, testimonials, changelog, analytics)
- **Deployment**: Vercel
- **Theme**: next-themes, dark by default

## Architecture

```
src/
  app/
    layout.tsx              # Root layout (Providers, SaasMaker widgets)
    page.tsx                # Landing page (redirects to /stars if authed)
    stars/page.tsx          # Main dashboard (client component, all filter/sort/view logic)
    explore/[...slug]/      # Repo detail page (comments, votes, likes)
    lists/[slug]/           # Public shared list page (SSR)
    api/
      auth/[...nextauth]/   # NextAuth route handler
      stars/
        route.ts            # GET starred repos (filtered, sorted, paginated, faceted)
        sync/route.ts       # POST sync from GitHub API + import GitHub star lists
      lists/                # GET/POST/PATCH/DELETE user lists
      repos/[repoId]/       # Tags, list assignment, likes, comments
  components/
    ui/                     # shadcn/ui primitives
    sidebar.tsx             # Language/list/tag filter sidebar
    top-bar.tsx             # Search, sort, view toggle, sync button
    repo-card.tsx           # Grid/list repo card
    repo-grid.tsx           # Virtualized repo grid
    tag-picker.tsx          # Tag management popover
    list-picker.tsx         # List assignment dropdown
  hooks/
    use-starred-repos.ts    # SWR hook: paginated repos, sync, facets
    use-lists.ts            # SWR hook: CRUD lists, assign repos
    use-repo-tags.ts        # Tag add/remove with optimistic mutation
  lib/
    auth.ts                 # NextAuth config (GitHub provider, JWT callbacks, user upsert)
    github.ts               # Fetch all starred repos from GitHub API (ETag caching)
    github-lists.ts         # Scrape public GitHub star lists (HTML parsing)
  db/
    index.ts                # Turso client singleton
    schema.sql              # Full DB schema (6 tables, 7 indexes)
    migrate.ts              # Migration script
```

## Database Schema (Turso/SQLite)

- `users` -- GitHub user (id, username, avatar)
- `repos` -- Cached repo metadata from GitHub
- `user_repos` -- Join: which user starred which repo (+ list_id, tags JSON, notes)
- `user_lists` -- Named collections with color, position, sharing (slug, is_public)
- `comments` -- Per-repo discussion comments
- `likes` -- Per-repo likes
- `comment_votes` -- Up/down votes on comments

Tags stored as JSON array in `user_repos.tags`.

## Key Conventions

- **No ORM** -- raw SQL via `@libsql/client`, batch queries where possible
- **Path alias**: `@/*` maps to `src/*`
- **API pattern**: auth check via `auth()`, return `NextResponse.json()`
- **Client data**: SWR with custom hooks in `src/hooks/`
- **URL state**: nuqs for all filter/sort params (shareable URLs)
- **Facets**: language/list/tag counts computed server-side

## Commands

```bash
pnpm dev                  # Start dev server
pnpm build                # Production build
pnpm lint                 # ESLint
pnpm db:migrate           # Run DB migrations
```

## Environment Variables

```
AUTH_SECRET=              # NextAuth secret
AUTH_GITHUB_ID=           # GitHub OAuth app client ID
AUTH_GITHUB_SECRET=       # GitHub OAuth app client secret
TURSO_DATABASE_URL=       # Turso DB URL
TURSO_AUTH_TOKEN=         # Turso auth token
AUTH_TRUST_HOST=true      # Required for Vercel
NEXT_PUBLIC_SAASMAKER_PROJECT_KEY=  # SaaS Maker project key (optional)
```

## Current State

**Done:**
- GitHub OAuth sign-in
- Full star sync with ETag caching + diff
- GitHub star list import (HTML scraping)
- Filtering by language, list, tag, full-text search
- Sorting: recently starred, most stars, recently updated, A-Z
- Grid/list view toggle
- Custom user lists (create, delete, share publicly, assign repos)
- Custom tags (add/remove, stored as JSON array)
- Repo detail page with comments + voting
- Public shared list pages (SSR)
- Dark mode (default), virtual scrolling
- SaasMaker integration

**Not done:**
- No tests
- No `.env.example` file
- No pre-push/pre-pull hooks
- No bulk operations
- No export/import functionality
