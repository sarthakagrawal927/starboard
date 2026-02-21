# Starboard

[![100% AI](https://img.shields.io/badge/Built%20with-100%25%20AI-blueviolet?style=for-the-badge)](https://claude.ai)
[![Live](https://img.shields.io/badge/Live-mystarboard.vercel.app-black?style=for-the-badge)](https://mystarboard.vercel.app)

Organize and filter your GitHub starred repos. Search, tag, categorize, and collect your stars in one place.

## Features

- **GitHub OAuth** — Sign in and sync your starred repos
- **Smart Categories** — Auto-categorize repos (AI/ML, Frontend, DevOps, etc.)
- **Custom Tags** — Create and assign colored tags to repos
- **Collections** — Group repos into named collections
- **Search** — Full-text search across name, description, and topics
- **Filter** — By language, category, tag, or collection
- **Sort** — Recently starred, most stars, recently updated, A-Z
- **Grid / List Views** — Toggle between card grid and compact list
- **Dark Mode** — Dark by default
- **Virtual Scroll** — Smooth performance with 1000+ repos
- **Manual Sync** — Sync on demand, see what's added/removed

## Tech Stack

- **Next.js 16** (App Router)
- **Tailwind CSS** + **shadcn/ui**
- **NextAuth v5** (GitHub OAuth)
- **Turso** (libSQL edge database)
- **SWR** for client-side data fetching
- **@tanstack/react-virtual** for virtualized scrolling

## Getting Started

```bash
npm install
cp .env.example .env.local  # fill in your credentials
npm run dev
```

## Environment Variables

```
AUTH_SECRET=
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
AUTH_TRUST_HOST=true
```
