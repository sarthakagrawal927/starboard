# Starboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a deployed web app for browsing, filtering, and organizing GitHub starred repos with OAuth login, smart categories, custom tags, and collections.

**Architecture:** Next.js App Router with server-side auth (NextAuth), GitHub API for star data, Vercel Postgres + Drizzle ORM for user data (tags, collections). All filtering/search is client-side on cached star data. API routes handle CRUD for tags/collections.

**Tech Stack:** Next.js 14, Tailwind CSS, shadcn/ui, NextAuth.js, Drizzle ORM, Vercel Postgres

---

### Task 1: Scaffold Next.js project

**Files:**
- Create: entire project scaffold via `create-next-app`
- Modify: `package.json` (will exist after scaffold)

**Step 1: Create the Next.js app**

Run:
```bash
cd /Users/sarthakagrawal/Desktop/starboard
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Accept overwriting existing files if prompted. This gives us:
- `src/app/layout.tsx`, `src/app/page.tsx`
- `tailwind.config.ts`, `tsconfig.json`, `next.config.mjs`

**Step 2: Verify it runs**

Run: `npm run dev` — visit http://localhost:3000, confirm default Next.js page loads.

**Step 3: Install shadcn/ui**

Run:
```bash
npx shadcn@latest init -d
```

This creates `components.json` and sets up `src/lib/utils.ts`.

**Step 4: Add core shadcn components we'll need**

Run:
```bash
npx shadcn@latest add button input badge card checkbox command dialog dropdown-menu popover scroll-area separator sheet skeleton toggle-group tooltip
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with Tailwind and shadcn/ui"
```

---

### Task 2: Set up GitHub OAuth with NextAuth

**Files:**
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/lib/auth.ts`
- Create: `.env.local` (do NOT commit)
- Modify: `src/app/layout.tsx`
- Create: `src/components/providers.tsx`

**Step 1: Install dependencies**

Run:
```bash
npm install next-auth@beta
```

Note: We use NextAuth v5 (beta) which works with App Router natively.

**Step 2: Create auth config**

Create `src/lib/auth.ts`:
```typescript
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      authorization: {
        params: {
          scope: "read:user",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.githubId = account.providerAccountId;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.user.githubId = token.githubId as string;
      return session;
    },
  },
});
```

**Step 3: Create route handler**

Create `src/app/api/auth/[...nextauth]/route.ts`:
```typescript
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

**Step 4: Add type augmentation**

Create `src/types/next-auth.d.ts`:
```typescript
import "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken: string;
    user: {
      githubId: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    githubId?: string;
  }
}
```

**Step 5: Create `.env.local`**

```
AUTH_SECRET=<generate with `npx auth secret`>
AUTH_GITHUB_ID=<from GitHub OAuth app settings>
AUTH_GITHUB_SECRET=<from GitHub OAuth app settings>
```

User will need to create a GitHub OAuth App at https://github.com/settings/developers:
- Homepage URL: `http://localhost:3000`
- Callback URL: `http://localhost:3000/api/auth/callback/github`

**Step 6: Create session provider wrapper**

Create `src/components/providers.tsx`:
```typescript
"use client";

import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

**Step 7: Wrap layout with providers**

Modify `src/app/layout.tsx` to wrap `{children}` with `<Providers>`.

**Step 8: Verify auth works**

Run `npm run dev`, click sign in, confirm GitHub OAuth redirect works and returns a session.

**Step 9: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth src/types/next-auth.d.ts src/components/providers.tsx src/app/layout.tsx
git commit -m "feat: add GitHub OAuth via NextAuth v5"
```

---

### Task 3: Set up database with Drizzle ORM

**Files:**
- Create: `src/db/schema.ts`
- Create: `src/db/index.ts`
- Create: `drizzle.config.ts`
- Modify: `.env.local` (add DATABASE_URL)
- Modify: `package.json` (add db scripts)

**Step 1: Install dependencies**

Run:
```bash
npm install drizzle-orm @vercel/postgres
npm install -D drizzle-kit
```

**Step 2: Create schema**

Create `src/db/schema.ts`:
```typescript
import { pgTable, text, timestamp, integer, serial } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(), // GitHub user ID
  username: text("username").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"),
});

export const repoTags = pgTable("repo_tags", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  repoId: integer("repo_id").notNull(), // GitHub repo ID
  tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
});

export const collections = pgTable("collections", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const collectionRepos = pgTable("collection_repos", {
  id: serial("id").primaryKey(),
  collectionId: integer("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" }),
  repoId: integer("repo_id").notNull(), // GitHub repo ID
});
```

**Step 3: Create DB connection**

Create `src/db/index.ts`:
```typescript
import { drizzle } from "drizzle-orm/vercel-postgres";
import { sql } from "@vercel/postgres";
import * as schema from "./schema";

export const db = drizzle(sql, { schema });
```

**Step 4: Create drizzle config**

Create `drizzle.config.ts`:
```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

**Step 5: Add db scripts to package.json**

Add to `"scripts"`:
```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:push": "drizzle-kit push",
"db:studio": "drizzle-kit studio"
```

**Step 6: Add DATABASE_URL to .env.local**

For local dev, use a local Postgres or Vercel Postgres connection string:
```
DATABASE_URL=postgres://...
```

**Step 7: Push schema to database**

Run: `npm run db:push`

**Step 8: Commit**

```bash
git add src/db drizzle.config.ts package.json package-lock.json
git commit -m "feat: add Drizzle ORM schema for users, tags, collections"
```

---

### Task 4: GitHub starred repos API route

**Files:**
- Create: `src/app/api/stars/route.ts`
- Create: `src/lib/github.ts`

**Step 1: Create GitHub API helper**

Create `src/lib/github.ts`:
```typescript
export interface StarredRepo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string; avatar_url: string };
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  topics: string[];
  updated_at: string;
  created_at: string;
}

export async function fetchAllStarredRepos(accessToken: string): Promise<StarredRepo[]> {
  const repos: StarredRepo[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await fetch(
      `https://api.github.com/user/starred?per_page=${perPage}&page=${page}&sort=created&direction=desc`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data: StarredRepo[] = await response.json();
    repos.push(...data);

    if (data.length < perPage) break;
    page++;
  }

  return repos;
}
```

**Step 2: Create API route**

Create `src/app/api/stars/route.ts`:
```typescript
import { auth } from "@/lib/auth";
import { fetchAllStarredRepos } from "@/lib/github";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const repos = await fetchAllStarredRepos(session.accessToken);
    return NextResponse.json(repos);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch stars" }, { status: 500 });
  }
}
```

**Step 3: Verify**

Run `npm run dev`, log in, visit `/api/stars` in browser — should return JSON array of starred repos.

**Step 4: Commit**

```bash
git add src/lib/github.ts src/app/api/stars/route.ts
git commit -m "feat: add GitHub starred repos API route"
```

---

### Task 5: User upsert on login

**Files:**
- Modify: `src/lib/auth.ts` (add signIn callback)

**Step 1: Add signIn callback to upsert user**

In `src/lib/auth.ts`, add to the `callbacks` object:
```typescript
async signIn({ user, account, profile }) {
  if (account?.provider === "github" && profile) {
    const { db } = await import("@/db");
    const { users } = await import("@/db/schema");
    await db
      .insert(users)
      .values({
        id: account.providerAccountId,
        username: (profile as any).login,
        avatarUrl: user.image ?? null,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          username: (profile as any).login,
          avatarUrl: user.image ?? null,
        },
      });
  }
  return true;
},
```

**Step 2: Verify**

Log out, log back in, check that a row appears in the `users` table (use `npm run db:studio`).

**Step 3: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat: upsert user to database on GitHub login"
```

---

### Task 6: Tags CRUD API routes

**Files:**
- Create: `src/app/api/tags/route.ts`
- Create: `src/app/api/tags/[id]/route.ts`
- Create: `src/app/api/repos/[repoId]/tags/route.ts`

**Step 1: Create tags list + create route**

Create `src/app/api/tags/route.ts`:
```typescript
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { tags } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.githubId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userTags = await db.select().from(tags).where(eq(tags.userId, session.user.githubId));
  return NextResponse.json(userTags);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.githubId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, color } = await req.json();
  const [tag] = await db.insert(tags).values({ userId: session.user.githubId, name, color }).returning();
  return NextResponse.json(tag, { status: 201 });
}
```

**Step 2: Create tag delete route**

Create `src/app/api/tags/[id]/route.ts`:
```typescript
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { tags } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.githubId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.delete(tags).where(and(eq(tags.id, parseInt(params.id)), eq(tags.userId, session.user.githubId)));
  return NextResponse.json({ ok: true });
}
```

**Step 3: Create repo tag assignment routes**

Create `src/app/api/repos/[repoId]/tags/route.ts`:
```typescript
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { repoTags } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: { repoId: string } }) {
  const session = await auth();
  if (!session?.user?.githubId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const assigned = await db
    .select()
    .from(repoTags)
    .where(and(eq(repoTags.userId, session.user.githubId), eq(repoTags.repoId, parseInt(params.repoId))));
  return NextResponse.json(assigned);
}

export async function POST(req: Request, { params }: { params: { repoId: string } }) {
  const session = await auth();
  if (!session?.user?.githubId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tagId } = await req.json();
  await db.insert(repoTags).values({
    userId: session.user.githubId,
    repoId: parseInt(params.repoId),
    tagId,
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: { repoId: string } }) {
  const session = await auth();
  if (!session?.user?.githubId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tagId } = await req.json();
  await db
    .delete(repoTags)
    .where(
      and(
        eq(repoTags.userId, session.user.githubId),
        eq(repoTags.repoId, parseInt(params.repoId)),
        eq(repoTags.tagId, tagId)
      )
    );
  return NextResponse.json({ ok: true });
}
```

**Step 4: Commit**

```bash
git add src/app/api/tags src/app/api/repos
git commit -m "feat: add tags CRUD and repo-tag assignment API routes"
```

---

### Task 7: Collections CRUD API routes

**Files:**
- Create: `src/app/api/collections/route.ts`
- Create: `src/app/api/collections/[slug]/route.ts`
- Create: `src/app/api/collections/[slug]/repos/route.ts`

**Step 1: Create collections list + create route**

Create `src/app/api/collections/route.ts`:
```typescript
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { collections } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.githubId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userCollections = await db.select().from(collections).where(eq(collections.userId, session.user.githubId));
  return NextResponse.json(userCollections);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.githubId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description } = await req.json();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const [collection] = await db
    .insert(collections)
    .values({ userId: session.user.githubId, name, slug, description })
    .returning();
  return NextResponse.json(collection, { status: 201 });
}
```

**Step 2: Create single collection + delete route**

Create `src/app/api/collections/[slug]/route.ts`:
```typescript
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { collections } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const session = await auth();
  if (!session?.user?.githubId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [collection] = await db
    .select()
    .from(collections)
    .where(and(eq(collections.userId, session.user.githubId), eq(collections.slug, params.slug)));

  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(collection);
}

export async function DELETE(_req: Request, { params }: { params: { slug: string } }) {
  const session = await auth();
  if (!session?.user?.githubId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db
    .delete(collections)
    .where(and(eq(collections.userId, session.user.githubId), eq(collections.slug, params.slug)));
  return NextResponse.json({ ok: true });
}
```

**Step 3: Create collection repos management route**

Create `src/app/api/collections/[slug]/repos/route.ts`:
```typescript
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { collections, collectionRepos } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const session = await auth();
  if (!session?.user?.githubId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [collection] = await db
    .select()
    .from(collections)
    .where(and(eq(collections.userId, session.user.githubId), eq(collections.slug, params.slug)));

  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const repos = await db.select().from(collectionRepos).where(eq(collectionRepos.collectionId, collection.id));
  return NextResponse.json(repos);
}

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const session = await auth();
  if (!session?.user?.githubId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [collection] = await db
    .select()
    .from(collections)
    .where(and(eq(collections.userId, session.user.githubId), eq(collections.slug, params.slug)));

  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { repoId } = await req.json();
  await db.insert(collectionRepos).values({ collectionId: collection.id, repoId });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: { slug: string } }) {
  const session = await auth();
  if (!session?.user?.githubId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [collection] = await db
    .select()
    .from(collections)
    .where(and(eq(collections.userId, session.user.githubId), eq(collections.slug, params.slug)));

  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { repoId } = await req.json();
  await db
    .delete(collectionRepos)
    .where(and(eq(collectionRepos.collectionId, collection.id), eq(collectionRepos.repoId, repoId)));
  return NextResponse.json({ ok: true });
}
```

**Step 4: Commit**

```bash
git add src/app/api/collections
git commit -m "feat: add collections CRUD and collection-repos API routes"
```

---

### Task 8: Smart categories logic

**Files:**
- Create: `src/lib/categories.ts`

**Step 1: Create category definitions and classifier**

Create `src/lib/categories.ts`:
```typescript
import { StarredRepo } from "./github";

export interface Category {
  name: string;
  slug: string;
  match: (repo: StarredRepo) => boolean;
}

const keywords = (terms: string[]) => (repo: StarredRepo) => {
  const text = `${repo.name} ${repo.description ?? ""} ${repo.topics.join(" ")}`.toLowerCase();
  return terms.some((t) => text.includes(t));
};

export const categories: Category[] = [
  { name: "AI / ML", slug: "ai-ml", match: keywords(["machine-learning", "deep-learning", "ai", "llm", "gpt", "neural", "ml", "nlp", "transformer", "diffusion"]) },
  { name: "DevOps", slug: "devops", match: keywords(["devops", "ci-cd", "docker", "kubernetes", "k8s", "terraform", "ansible", "helm", "monitoring", "observability"]) },
  { name: "Frontend", slug: "frontend", match: keywords(["react", "vue", "svelte", "angular", "frontend", "css", "ui-component", "tailwind", "nextjs"]) },
  { name: "Backend", slug: "backend", match: keywords(["api", "backend", "server", "rest", "graphql", "microservice", "database", "orm"]) },
  { name: "CLI Tools", slug: "cli-tools", match: keywords(["cli", "terminal", "command-line", "shell", "bash", "zsh"]) },
  { name: "Security", slug: "security", match: keywords(["security", "authentication", "encryption", "vulnerability", "pentest", "owasp"]) },
  { name: "Data", slug: "data", match: keywords(["data", "analytics", "visualization", "pandas", "sql", "etl", "pipeline", "streaming"]) },
  { name: "Learning", slug: "learning", match: keywords(["tutorial", "learn", "course", "awesome", "guide", "cheatsheet", "interview", "algorithm"]) },
  { name: "Self-Hosted", slug: "self-hosted", match: keywords(["self-hosted", "selfhosted", "homelab", "home-server", "docker-compose"]) },
];

export function categorizeRepos(repos: StarredRepo[]): Record<string, StarredRepo[]> {
  const result: Record<string, StarredRepo[]> = {};
  for (const cat of categories) {
    result[cat.slug] = repos.filter(cat.match);
  }
  result["uncategorized"] = repos.filter((r) => !categories.some((c) => c.match(r)));
  return result;
}
```

**Step 2: Commit**

```bash
git add src/lib/categories.ts
git commit -m "feat: add smart category classifier for starred repos"
```

---

### Task 9: Client-side data hooks

**Files:**
- Create: `src/hooks/use-starred-repos.ts`
- Create: `src/hooks/use-tags.ts`
- Create: `src/hooks/use-collections.ts`

**Step 1: Install SWR for data fetching**

Run: `npm install swr`

**Step 2: Create starred repos hook**

Create `src/hooks/use-starred-repos.ts`:
```typescript
import useSWR from "swr";
import { StarredRepo } from "@/lib/github";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useStarredRepos() {
  const { data, error, isLoading } = useSWR<StarredRepo[]>("/api/stars", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000 * 5, // cache for 5 min
  });

  return { repos: data ?? [], error, isLoading };
}
```

**Step 3: Create tags hook**

Create `src/hooks/use-tags.ts`:
```typescript
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Tag {
  id: number;
  userId: string;
  name: string;
  color: string;
}

export function useTags() {
  const { data, error, isLoading, mutate } = useSWR<Tag[]>("/api/tags", fetcher);

  const createTag = async (name: string, color: string) => {
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    const tag = await res.json();
    mutate();
    return tag;
  };

  const deleteTag = async (id: number) => {
    await fetch(`/api/tags/${id}`, { method: "DELETE" });
    mutate();
  };

  return { tags: data ?? [], error, isLoading, createTag, deleteTag, mutate };
}
```

**Step 4: Create collections hook**

Create `src/hooks/use-collections.ts`:
```typescript
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Collection {
  id: number;
  userId: string;
  name: string;
  slug: string;
  description: string | null;
}

export function useCollections() {
  const { data, error, isLoading, mutate } = useSWR<Collection[]>("/api/collections", fetcher);

  const createCollection = async (name: string, description?: string) => {
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    const collection = await res.json();
    mutate();
    return collection;
  };

  const deleteCollection = async (slug: string) => {
    await fetch(`/api/collections/${slug}`, { method: "DELETE" });
    mutate();
  };

  return { collections: data ?? [], error, isLoading, createCollection, deleteCollection, mutate };
}
```

**Step 5: Commit**

```bash
git add src/hooks package.json package-lock.json
git commit -m "feat: add SWR data hooks for stars, tags, collections"
```

---

### Task 10: Landing page

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Build landing page**

Replace `src/app/page.tsx` with a landing page containing:
- App name "Starboard" + tagline "Your GitHub stars, organized."
- "Sign in with GitHub" button (calls `signIn("github")`)
- 3 feature highlights (Filter, Categorize, Collect) with brief descriptions
- Clean, minimal design using shadcn/ui components

Use `@frontend-design` skill for implementation.

**Step 2: Update layout metadata**

Update `src/app/layout.tsx` metadata:
```typescript
export const metadata: Metadata = {
  title: "Starboard",
  description: "Your GitHub stars, organized.",
};
```

**Step 3: Verify**

Visit http://localhost:3000, confirm landing page renders, sign in button works.

**Step 4: Commit**

```bash
git add src/app/page.tsx src/app/layout.tsx
git commit -m "feat: add landing page with GitHub sign-in"
```

---

### Task 11: Main dashboard layout

**Files:**
- Create: `src/app/stars/page.tsx`
- Create: `src/app/stars/layout.tsx`
- Create: `src/components/sidebar.tsx`
- Create: `src/components/top-bar.tsx`
- Create: `src/components/repo-card.tsx`
- Create: `src/components/repo-grid.tsx`

**Step 1: Create dashboard layout**

Create `src/app/stars/layout.tsx` — a layout with:
- Sticky top bar
- Left sidebar (280px) with scrollable content
- Main content area

**Step 2: Create top bar component**

Create `src/components/top-bar.tsx`:
- Search input (full-text search, controlled)
- Sort dropdown (recently starred, most stars, recently updated, name)
- View toggle (grid / list)
- User avatar + sign out button on the right

**Step 3: Create sidebar component**

Create `src/components/sidebar.tsx`:
- "Languages" section: checkboxes for top languages (computed from repos)
- "Categories" section: clickable list of smart categories with counts
- "Tags" section: user's custom tags with counts + "New tag" button
- "Collections" section: collection list + "New collection" button

**Step 4: Create repo card component**

Create `src/components/repo-card.tsx`:
- Owner avatar + repo full name (linked to GitHub)
- Description (truncated)
- Language badge (colored dot)
- Star count
- Topic badges (first 3-4)
- Custom tag badges
- "Add to collection" button (popover with collection list)

**Step 5: Create repo grid component**

Create `src/components/repo-grid.tsx`:
- Accepts filtered/sorted repos array
- Renders as responsive grid (grid view) or vertical list (list view)
- Shows skeleton cards while loading
- Shows "No repos match your filters" empty state

**Step 6: Create dashboard page**

Create `src/app/stars/page.tsx`:
- Uses `useStarredRepos`, `useTags`, `useCollections` hooks
- Manages filter/search/sort state
- Applies client-side filtering (language, category, tag, search, collection)
- Passes filtered repos to `RepoGrid`
- Redirects to `/` if not authenticated

Use `@frontend-design` skill for all UI implementation.

**Step 7: Verify**

Log in, visit `/stars`, confirm:
- Repos load and display in grid
- Search filters by name/description
- Language checkboxes filter
- Sort changes order
- Grid/list toggle works

**Step 8: Commit**

```bash
git add src/app/stars src/components
git commit -m "feat: add main dashboard with search, filter, sort, and grid/list views"
```

---

### Task 12: Tag management UI

**Files:**
- Create: `src/components/create-tag-dialog.tsx`
- Create: `src/components/tag-picker.tsx`
- Modify: `src/components/sidebar.tsx` (wire up new tag button)
- Modify: `src/components/repo-card.tsx` (wire up tag picker)

**Step 1: Create tag creation dialog**

Create `src/components/create-tag-dialog.tsx`:
- Dialog with name input + color picker (preset palette of 8-10 colors)
- Calls `createTag` from `useTags` hook on submit

**Step 2: Create tag picker for repo cards**

Create `src/components/tag-picker.tsx`:
- Popover triggered from repo card
- Shows all user tags with checkboxes
- Toggling a checkbox calls POST/DELETE on `/api/repos/[repoId]/tags`

**Step 3: Wire into sidebar and repo card**

- Sidebar "New tag" button opens `CreateTagDialog`
- Repo card tag button opens `TagPicker`

**Step 4: Verify**

Create a tag, assign it to a repo, filter by tag in sidebar.

**Step 5: Commit**

```bash
git add src/components
git commit -m "feat: add tag creation dialog and repo tag picker"
```

---

### Task 13: Collection management UI

**Files:**
- Create: `src/components/create-collection-dialog.tsx`
- Create: `src/components/collection-picker.tsx`
- Create: `src/app/stars/collection/[slug]/page.tsx`
- Modify: `src/components/sidebar.tsx`
- Modify: `src/components/repo-card.tsx`

**Step 1: Create collection creation dialog**

Create `src/components/create-collection-dialog.tsx`:
- Dialog with name + optional description inputs
- Calls `createCollection` from `useCollections` hook

**Step 2: Create collection picker for repo cards**

Create `src/components/collection-picker.tsx`:
- Popover showing all collections with checkboxes
- Toggling calls POST/DELETE on `/api/collections/[slug]/repos`

**Step 3: Create collection view page**

Create `src/app/stars/collection/[slug]/page.tsx`:
- Fetches collection metadata + repo IDs
- Cross-references with starred repos data
- Shows same repo grid but scoped to collection

**Step 4: Wire into sidebar and repo card**

- Sidebar collections list links to `/stars/collection/[slug]`
- Sidebar "New collection" button opens dialog
- Repo card "Add to collection" opens picker

**Step 5: Verify**

Create a collection, add repos, navigate to collection page, see only those repos.

**Step 6: Commit**

```bash
git add src/components src/app/stars/collection
git commit -m "feat: add collection management and collection view page"
```

---

### Task 14: Polish and deploy

**Files:**
- Modify: various component files for polish
- Create: `src/app/favicon.ico` (optional)
- Modify: `next.config.mjs` (image domains)

**Step 1: Add GitHub avatar image domain**

In `next.config.mjs`:
```javascript
images: {
  remotePatterns: [
    { protocol: "https", hostname: "avatars.githubusercontent.com" },
  ],
},
```

**Step 2: Add loading states**

Ensure skeleton loading states exist for:
- Initial repo fetch (skeleton cards)
- Sidebar sections while data loads

**Step 3: Add empty states**

- No repos match filters: "No repos match your filters. Try adjusting your search."
- No collections yet: "Create your first collection to organize repos."
- No tags yet: "Create tags to label your repos."

**Step 4: Responsive design pass**

- Sidebar collapses to sheet/drawer on mobile
- Repo grid goes single-column on small screens
- Top bar search is collapsible on mobile

**Step 5: Verify full flow**

1. Visit landing page → sign in
2. See all starred repos load
3. Search, filter by language, filter by category
4. Create tags, assign to repos, filter by tag
5. Create collection, add repos, view collection page
6. Toggle grid/list, change sort order
7. Sign out, return to landing

**Step 6: Deploy to Vercel**

Run:
```bash
npx vercel
```

Configure:
- Link to Vercel project
- Set environment variables (AUTH_SECRET, AUTH_GITHUB_ID, AUTH_GITHUB_SECRET, DATABASE_URL)
- Update GitHub OAuth app callback URL to production domain

**Step 7: Commit any final changes**

```bash
git add -A
git commit -m "feat: polish UI, add loading/empty states, responsive design"
```

---

## Summary

| Task | Description | Dependencies |
|------|-------------|-------------|
| 1 | Scaffold Next.js + shadcn/ui | None |
| 2 | GitHub OAuth with NextAuth | Task 1 |
| 3 | Database schema with Drizzle | Task 1 |
| 4 | GitHub starred repos API route | Task 2 |
| 5 | User upsert on login | Tasks 2, 3 |
| 6 | Tags CRUD API routes | Tasks 3, 5 |
| 7 | Collections CRUD API routes | Tasks 3, 5 |
| 8 | Smart categories logic | Task 4 |
| 9 | Client-side data hooks | Tasks 4, 6, 7 |
| 10 | Landing page | Task 2 |
| 11 | Main dashboard (core UI) | Tasks 8, 9 |
| 12 | Tag management UI | Tasks 6, 11 |
| 13 | Collection management UI | Tasks 7, 11 |
| 14 | Polish and deploy | All above |
