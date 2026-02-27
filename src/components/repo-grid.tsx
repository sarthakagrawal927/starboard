"use client";

import { useRef, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { UserRepo } from "@/hooks/use-starred-repos";
import { RepoCard } from "@/components/repo-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Inbox, RotateCcw } from "lucide-react";

interface RepoGridProps {
  repos: UserRepo[];
  viewMode: "grid" | "list";
  isLoading: boolean;
  repoTagMap?: Record<number, string[]>;
  allTags?: string[];
  onAddTag?: (repoId: number, tag: string) => void;
  onRemoveTag?: (repoId: number, tag: string) => void;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
}

function SkeletonCard({ viewMode }: { viewMode: "grid" | "list" }) {
  if (viewMode === "list") {
    return (
      <div className="flex items-start gap-4 rounded-lg border bg-card p-4">
        <Skeleton className="size-8 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-4 w-36" />
      </div>
      <Skeleton className="mt-3 h-3 w-full" />
      <Skeleton className="mt-1.5 h-3 w-3/4" />
      <div className="mt-auto pt-4">
        <div className="mb-3 flex gap-1.5">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-10" />
        </div>
      </div>
    </div>
  );
}

export function RepoGrid({
  repos,
  viewMode,
  isLoading,
  repoTagMap = {},
  allTags,
  onAddTag,
  onRemoveTag,
  hasActiveFilters,
  onClearFilters,
}: RepoGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // For grid mode, group repos into rows
  // We need to know the column count -- use a fixed approach based on common breakpoints
  // Grid: 1 col < 640px, 2 cols 640-1024px, 3 cols 1024px+
  // For virtualization, we'll use list mode virtualization for both views
  // Grid items get rendered in rows

  const columns = viewMode === "grid" ? 3 : 1;

  const rows = useMemo(() => {
    if (viewMode === "list") return repos.map((r) => [r]);
    const result: UserRepo[][] = [];
    for (let i = 0; i < repos.length; i += columns) {
      result.push(repos.slice(i, i + columns));
    }
    return result;
  }, [repos, viewMode, columns]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (viewMode === "grid" ? 240 : 100),
    overscan: 5,
  });

  if (isLoading) {
    return (
      <div
        className={
          viewMode === "grid"
            ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
            : "flex flex-col gap-2"
        }
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} viewMode={viewMode} />
        ))}
      </div>
    );
  }

  if (repos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Inbox className="mb-4 size-12 text-muted-foreground/50" />
        <h3 className="text-lg font-medium text-foreground">
          No repos match your filters
        </h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Try adjusting your search or filter criteria to find what you are
          looking for.
        </p>
        {hasActiveFilters && onClearFilters && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4 gap-2"
            onClick={onClearFilters}
          >
            <RotateCcw className="size-3.5" />
            Reset all filters
          </Button>
        )}
      </div>
    );
  }

  return (
    <div ref={parentRef} className="h-[calc(100svh-65px)] overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const rowRepos = rows[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 gap-3 px-0 pb-3 sm:grid-cols-2 lg:grid-cols-3"
                  : "pb-2"
              }
            >
              {rowRepos.map((repo) => {
                const repoTags = repoTagMap[repo.id] ?? [];
                return (
                  <RepoCard
                    key={repo.id}
                    repo={repo}
                    viewMode={viewMode}
                    tags={repoTags}
                    allTags={allTags}
                    onAddTag={onAddTag}
                    onRemoveTag={onRemoveTag}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
