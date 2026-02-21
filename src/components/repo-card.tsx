"use client";

import Image from "next/image";
import { StarredRepo } from "@/lib/github";
import { Badge } from "@/components/ui/badge";
import { Star, ExternalLink } from "lucide-react";
import { TagPicker } from "@/components/tag-picker";
import { CollectionPicker } from "@/components/collection-picker";

interface Tag {
  id: number;
  user_id: string;
  name: string;
  color: string;
}

interface Collection {
  id: number;
  user_id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
}

const languageColors: Record<string, string> = {
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  Python: "#3572A5",
  Rust: "#dea584",
  Go: "#00ADD8",
  Java: "#b07219",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  Ruby: "#701516",
  PHP: "#4F5D95",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Dart: "#00B4AB",
  Scala: "#c22d40",
  Shell: "#89e051",
  Lua: "#000080",
  Elixir: "#6e4a7e",
  Haskell: "#5e5086",
  Clojure: "#db5855",
  Zig: "#ec915c",
  Vim: "#199f4b",
  HTML: "#e34c26",
  CSS: "#563d7c",
  SCSS: "#c6538c",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  Jupyter: "#DA5B0B",
  R: "#198CE7",
  Markdown: "#083fa1",
};

function formatStarCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}k`;
  }
  return count.toString();
}

interface RepoCardProps {
  repo: StarredRepo;
  tags?: Tag[];
  allTags?: Tag[];
  collections?: Collection[];
  viewMode?: "grid" | "list";
}

export function RepoCard({
  repo,
  tags,
  allTags,
  collections,
  viewMode = "grid",
}: RepoCardProps) {
  const langColor = repo.language
    ? languageColors[repo.language] ?? "#8b8b8b"
    : null;

  const isGitHubAvatar = repo.owner.avatar_url.includes(
    "avatars.githubusercontent.com"
  );

  const avatar = isGitHubAvatar ? (
    <Image
      src={repo.owner.avatar_url}
      alt={repo.owner.login}
      width={viewMode === "list" ? 32 : 24}
      height={viewMode === "list" ? 32 : 24}
      className={`rounded-full ${viewMode === "list" ? "size-8" : "size-6"}`}
    />
  ) : (
    <img
      src={repo.owner.avatar_url}
      alt={repo.owner.login}
      className={viewMode === "list" ? "size-8 rounded-full" : "size-6 rounded-full"}
      loading="lazy"
    />
  );

  if (viewMode === "list") {
    return (
      <div className="group flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50 sm:gap-4 sm:p-4">
        <div className="shrink-0">{avatar}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <a
              href={repo.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate font-medium text-foreground hover:underline"
            >
              <span className="text-muted-foreground">
                {repo.owner.login}/
              </span>
              {repo.name}
            </a>
            <ExternalLink className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
              {allTags && (
                <TagPicker repoId={repo.id} tags={allTags} />
              )}
              {collections && collections.length > 0 && (
                <CollectionPicker repoId={repo.id} collections={collections} />
              )}
              {repo.language && (
                <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                  <span
                    className="inline-block size-2.5 rounded-full"
                    style={{ backgroundColor: langColor ?? undefined }}
                  />
                  {repo.language}
                </span>
              )}
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="size-3 fill-current" />
                {formatStarCount(repo.stargazers_count)}
              </span>
            </div>
          </div>
          {repo.description && (
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {repo.description}
            </p>
          )}
          {(repo.topics.length > 0 || (tags && tags.length > 0)) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {repo.topics.slice(0, 4).map((topic) => (
                <Badge
                  key={topic}
                  variant="secondary"
                  className="text-[10px] font-normal"
                >
                  {topic}
                </Badge>
              ))}
              {tags?.map((tag) => (
                <Badge
                  key={tag.id}
                  className="text-[10px] font-normal"
                  style={{
                    backgroundColor: tag.color + "20",
                    color: tag.color,
                    borderColor: tag.color + "40",
                  }}
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="group flex flex-col rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50">
      <div className="flex items-start gap-3">
        <div className="shrink-0">{avatar}</div>
        <div className="min-w-0 flex-1">
          <a
            href={repo.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-medium leading-tight text-foreground hover:underline"
          >
            <span className="truncate">
              <span className="text-muted-foreground">
                {repo.owner.login}/
              </span>
              {repo.name}
            </span>
            <ExternalLink className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </a>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {allTags && (
            <TagPicker repoId={repo.id} tags={allTags} />
          )}
          {collections && collections.length > 0 && (
            <CollectionPicker repoId={repo.id} collections={collections} />
          )}
        </div>
      </div>

      {repo.description && (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {repo.description}
        </p>
      )}

      <div className="mt-auto pt-3">
        {(repo.topics.length > 0 || (tags && tags.length > 0)) && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {repo.topics.slice(0, 4).map((topic) => (
              <Badge
                key={topic}
                variant="secondary"
                className="text-[10px] font-normal"
              >
                {topic}
              </Badge>
            ))}
            {tags?.map((tag) => (
              <Badge
                key={tag.id}
                className="text-[10px] font-normal"
                style={{
                  backgroundColor: tag.color + "20",
                  color: tag.color,
                  borderColor: tag.color + "40",
                }}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {repo.language && (
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 rounded-full"
                style={{ backgroundColor: langColor ?? undefined }}
              />
              {repo.language}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Star className="size-3 fill-current" />
            {formatStarCount(repo.stargazers_count)}
          </span>
        </div>
      </div>
    </div>
  );
}
