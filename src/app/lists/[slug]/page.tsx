import { notFound } from "next/navigation";
import { db } from "@/db";
import type { Metadata } from "next";

interface Repo {
  id: number;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  html_url: string;
  owner_login: string;
  owner_avatar: string;
  topics: string | null;
}

interface ListData {
  id: number;
  name: string;
  color: string;
  icon: string | null;
  description: string | null;
  user_id: string;
  username: string;
  avatar_url: string;
}

async function getPublicList(slug: string) {
  const listResult = await db.execute({
    sql: `SELECT ul.id, ul.name, ul.color, ul.icon, ul.description, ul.user_id,
                 u.username, u.avatar_url
          FROM user_lists ul
          JOIN users u ON u.id = ul.user_id
          WHERE ul.slug = ? AND ul.is_public = 1`,
    args: [slug],
  });

  if (listResult.rows.length === 0) return null;

  const row = listResult.rows[0] as unknown as ListData;

  const reposResult = await db.execute({
    sql: `SELECT r.id, r.full_name, r.description, r.language,
                 r.stargazers_count, r.html_url, r.owner_login, r.owner_avatar,
                 r.topics
          FROM user_repos ur
          JOIN repos r ON r.id = ur.repo_id
          WHERE ur.list_id = ? AND ur.user_id = ?
          ORDER BY r.stargazers_count DESC`,
    args: [row.id, row.user_id],
  });

  return {
    list: {
      id: row.id,
      name: row.name,
      color: row.color,
      icon: row.icon,
      description: row.description,
    },
    owner: {
      username: row.username,
      avatar_url: row.avatar_url,
    },
    repos: reposResult.rows as unknown as Repo[],
  };
}

function formatStars(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(count);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicList(slug);

  if (!data) {
    return { title: "List not found" };
  }

  return {
    title: `${data.list.name} - Starboard`,
    description:
      data.list.description ||
      `A curated list of ${data.repos.length} GitHub repos by @${data.owner.username}`,
  };
}

export default async function PublicListPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getPublicList(slug);

  if (!data) {
    notFound();
  }

  const { list, owner, repos } = data;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <div className="flex items-center gap-3">
            <span
              className="inline-block size-4 shrink-0 rounded-full"
              style={{ backgroundColor: list.color }}
              aria-hidden="true"
            />
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {list.name}
            </h1>
          </div>
          {list.description && (
            <p className="mt-2 text-muted-foreground">{list.description}</p>
          )}

          {/* Owner bar */}
          <div className="mt-4 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={owner.avatar_url}
              alt={owner.username}
              width={24}
              height={24}
              className="size-6 rounded-full"
            />
            <span className="text-sm text-muted-foreground">
              Curated by{" "}
              <a
                href={`https://github.com/${owner.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground hover:underline"
              >
                @{owner.username}
              </a>
            </span>
            <span className="text-sm text-muted-foreground">
              &middot; {repos.length} {repos.length === 1 ? "repo" : "repos"}
            </span>
          </div>
        </div>
      </header>

      {/* Repo grid */}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {repos.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-lg text-muted-foreground">This list is empty</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {repos.map((repo) => (
              <a
                key={repo.id}
                href={repo.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20 hover:bg-accent/50"
              >
                {/* Top row: avatar + name + stars */}
                <div className="flex items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={repo.owner_avatar}
                    alt={repo.owner_login}
                    width={24}
                    height={24}
                    className="size-6 shrink-0 rounded-full"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold group-hover:underline">
                    {repo.full_name}
                  </span>
                  <span
                    className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
                    title={`${repo.stargazers_count.toLocaleString()} stars`}
                  >
                    <svg
                      className="size-3.5"
                      fill="currentColor"
                      viewBox="0 0 16 16"
                      aria-hidden="true"
                    >
                      <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
                    </svg>
                    {formatStars(repo.stargazers_count)}
                  </span>
                </div>

                {/* Description */}
                {repo.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {repo.description}
                  </p>
                )}

                {/* Language */}
                {repo.language && (
                  <div className="mt-auto flex items-center gap-1.5 pt-3">
                    <span className="inline-block size-2.5 rounded-full bg-current opacity-60" />
                    <span className="text-xs text-muted-foreground">
                      {repo.language}
                    </span>
                  </div>
                )}
              </a>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto max-w-5xl px-4 py-6 text-center sm:px-6">
          <a
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            Built with Starboard
          </a>
        </div>
      </footer>
    </div>
  );
}
