# Starboard - Design Document

## What

A deployed web app for browsing, filtering, searching, and organizing GitHub starred repos. Users log in with GitHub OAuth, and the app fetches their stars and provides rich filtering, smart categorization, custom tags, and collections.

## Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS + shadcn/ui
- **Auth:** NextAuth.js with GitHub OAuth provider
- **Database:** Vercel Postgres (for custom tags, collections, user preferences)
- **ORM:** Drizzle ORM
- **Deployment:** Vercel

## Pages

- `/` — Landing page with GitHub login CTA
- `/stars` — Main dashboard (all starred repos with filters/search)
- `/stars/collection/[slug]` — View a specific user-created collection

## Features

### Filtering & Search
- Filter by programming language (from repo metadata)
- Filter by GitHub topics/tags
- Full-text search across repo name, description, and topics
- Sort by: recently starred, most stars, recently updated, name

### Smart Categories
- Auto-categorize repos based on GitHub topics and description keywords
- Categories like: AI/ML, DevOps, Frontend, Backend, CLI Tools, Learning Resources, etc.
- Category assignment runs client-side on fetched data (no AI needed — keyword/topic matching)

### Custom Tags & Collections
- Users can create custom tags and apply them to repos
- Users can create named collections (groups of repos)
- Tags and collections stored in Vercel Postgres, keyed to GitHub user ID
- Drag-and-drop or click to add repos to collections

## Data Flow

1. User authenticates via GitHub OAuth (NextAuth)
2. App calls GitHub API `/user/starred` (paginated, up to 1000 repos)
3. Star data cached in-memory (or localStorage) for the session to avoid repeated API calls
4. Custom tags/collections fetched from Postgres on load
5. All filtering/search happens client-side on the cached data

## Data Model

### `users` table
- `id` (GitHub user ID)
- `username`
- `avatar_url`
- `created_at`

### `tags` table
- `id`
- `user_id` (FK -> users)
- `name`
- `color`

### `repo_tags` table (junction)
- `user_id`
- `repo_id` (GitHub repo ID)
- `tag_id` (FK -> tags)

### `collections` table
- `id`
- `user_id` (FK -> users)
- `name`
- `slug`
- `description`

### `collection_repos` table (junction)
- `collection_id` (FK -> collections)
- `repo_id` (GitHub repo ID)

## UI Design

### Main Dashboard (`/stars`)
- **Top bar:** Search input, sort dropdown, view toggle (grid/list)
- **Left sidebar:** Language filters (checkboxes), smart categories, custom tags, collections list
- **Main area:** Repo cards in grid or list view
- **Repo card:** Repo name, owner, description, language badge, star count, topics, custom tags, "add to collection" button

### Landing Page (`/`)
- Hero with app name + tagline
- "Sign in with GitHub" button
- Brief feature highlights

## Non-Goals (for v1)
- README previews/rendering
- Repo activity graphs
- Social features (sharing collections)
- Import/export
- Mobile-native app
