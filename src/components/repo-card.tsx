"use client";

import { Archive, Bookmark, Clock3, Star } from "lucide-react";
import Link from "next/link";
import { memo } from "react";

import { ListPicker } from "@/components/list-picker";
import { Badge } from "@/components/ui/badge";
import type { UserList } from "@/hooks/use-lists";
import type { UserRepo } from "@/hooks/use-starred-repos";
import { getAvatarImageAttrs } from "@/lib/avatar";

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

function formatUpdatedDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

interface RepoCardProps {
  repo: UserRepo;
  lists?: UserList[];
  onAssignList?: (repoId: number, listId: number, assigned: boolean) => void;
  onToggleSave?: (repoId: number, saved: boolean) => void;
  viewMode?: "grid" | "list";
}

export const RepoCard = memo(function RepoCard({
  repo,
  lists,
  onAssignList,
  onToggleSave,
  viewMode = "grid",
}: RepoCardProps) {
  const langColor = repo.language
    ? languageColors[repo.language] ?? "#8b8b8b"
    : null;

  const avatarSize = viewMode === "list" ? 32 : 24;
  const avatarImage = getAvatarImageAttrs(repo.owner.avatar_url, avatarSize);
  const avatar = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarImage.src}
      srcSet={avatarImage.srcSet}
      sizes={avatarImage.sizes}
      alt={repo.owner.login}
      width={avatarSize}
      height={avatarSize}
      className={viewMode === "list" ? "size-8 rounded-full" : "size-6 rounded-full"}
      loading="lazy"
      decoding="async"
    />
  );
  const isSaved = Boolean(repo.is_saved);
  const updatedDate = formatUpdatedDate(repo.updated_at);
  const collectionIds = repo.collection_ids ?? [];
  const saveButton = onToggleSave ? (
    <button
      type="button"
      onClick={() => onToggleSave(repo.id, !isSaved)}
      className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent-foreground/10 hover:text-foreground"
      title={isSaved ? "Remove from library" : "Save to library"}
      aria-label={isSaved ? "Remove from library" : "Save to library"}
    >
      <Bookmark className={`size-3.5${isSaved ? " fill-current text-primary" : ""}`} />
    </button>
  ) : null;

  if (viewMode === "list") {
    return (
      <div className="group grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-4 sm:p-4">
        <div className="shrink-0">{avatar}</div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href={`/explore/${repo.full_name}`}
              className="truncate font-medium text-foreground hover:underline"
            >
              <span className="text-muted-foreground">
                {repo.owner.login}/
              </span>
              {repo.name}
            </Link>
            {repo.archived && (
              <Badge variant="outline" className="hidden shrink-0 gap-1 text-[10px] font-normal uppercase tracking-normal text-muted-foreground sm:inline-flex">
                <Archive className="size-3" />
                Archived
              </Badge>
            )}
          </div>
          {repo.description && (
            <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
              {repo.description}
            </p>
          )}
          <div className="mt-2 flex min-h-5 flex-wrap items-center gap-1.5">
            {repo.archived && (
              <Badge variant="outline" className="gap-1 text-[10px] font-normal uppercase tracking-normal text-muted-foreground sm:hidden">
                <Archive className="size-3" />
                Archived
              </Badge>
            )}
            {repo.topics.length > 0 && (
              <>
              {repo.topics.slice(0, 4).map((topic) => (
                <Badge
                  key={topic}
                  variant="secondary"
                  className="text-[10px] font-normal"
                >
                  {topic}
                </Badge>
              ))}
              </>
            )}
          </div>
        </div>
        <div className="col-start-2 flex shrink-0 items-center justify-between gap-2 text-xs text-muted-foreground sm:col-start-auto sm:min-w-64 sm:justify-end sm:gap-3">
          {repo.language && (
            <span className="hidden items-center gap-1.5 md:flex">
              <span
                className="inline-block size-2.5 rounded-full"
                style={{ backgroundColor: langColor ?? undefined }}
              />
              {repo.language}
            </span>
          )}
          {updatedDate && (
            <span className="hidden items-center gap-1 lg:flex">
              <Clock3 className="size-3" />
              {updatedDate}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Star className="size-3 fill-current" />
            {formatStarCount(repo.stargazers_count)}
          </span>
          {saveButton}
          {lists && onAssignList && (
            <ListPicker repoId={repo.id} currentListIds={collectionIds} lists={lists} onAssign={onAssignList} />
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
          <Link
            href={`/explore/${repo.full_name}`}
            className="inline-flex items-center gap-1.5 font-medium leading-tight text-foreground hover:underline"
          >
            <span className="truncate">
              <span className="text-muted-foreground">
                {repo.owner.login}/
              </span>
              {repo.name}
            </span>
          </Link>
          {repo.archived && (
            <Badge variant="outline" className="mt-1 inline-flex gap-1 text-[10px] font-normal uppercase tracking-normal text-muted-foreground">
              <Archive className="size-3" />
              Archived
            </Badge>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {saveButton}
          {lists && onAssignList && (
            <ListPicker repoId={repo.id} currentListIds={collectionIds} lists={lists} onAssign={onAssignList} />
          )}
        </div>
      </div>

      {repo.description && (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {repo.description}
        </p>
      )}

      <div className="mt-auto pt-3">
        {repo.topics.length > 0 && (
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
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
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
          {updatedDate && (
            <span className="flex items-center gap-1">
              <Clock3 className="size-3" />
              {updatedDate}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
