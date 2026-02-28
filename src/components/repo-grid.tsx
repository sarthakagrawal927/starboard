"use client";

import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { UserRepo } from "@/hooks/use-starred-repos";
import { RepoCard } from "@/components/repo-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Inbox, RotateCcw } from "lucide-react";

function widthToColumns(width: number): number {
  if (width >= 1024) return 3;
  if (width >= 640) return 2;
  return 1;
}

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
  total?: number;
  offset?: number;
  limit?: number;
  onPageChange?: (newOffset: number) => void;
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
  total,
  offset,
  limit,
  onPageChange,
}: RepoGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(viewMode === "grid" ? 3 : 1);

  // Track container width to compute responsive column count
  useEffect(() => {
    if (viewMode !== "grid") {
      setColumns(1);
      return;
    }
    const el = parentRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setColumns(widthToColumns(width));
    });
    ro.observe(el);
    // Set initial value
    setColumns(widthToColumns(el.clientWidth));
    return () => ro.disconnect();
  }, [viewMode]);

  const rows = useMemo(() => {
    if (viewMode === "list") return repos.map((r) => [r]);
    const result: UserRepo[][] = [];
    for (let i = 0; i < repos.length; i += columns) {
      result.push(repos.slice(i, i + columns));
    }
    return result;
  }, [repos, viewMode, columns]);

  const estimateSize = useCallback(
    () => (viewMode === "grid" ? 240 : 100),
    [viewMode]
  );

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
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
    <>
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
                  ...(viewMode === "grid"
                    ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
                    : {}),
                }}
                className={
                  viewMode === "grid"
                    ? "grid gap-3 px-0 pb-3"
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
      {total != null && limit != null && onPageChange && total > limit && (
        <div className="flex items-center justify-between border-t px-1 pt-4">
          <span className="text-sm text-muted-foreground">
            {(offset ?? 0) + 1}&ndash;{Math.min((offset ?? 0) + limit, total)} of {total}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={(offset ?? 0) === 0}
              onClick={() => onPageChange(Math.max((offset ?? 0) - limit, 0))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={(offset ?? 0) + limit >= total}
              onClick={() => onPageChange((offset ?? 0) + limit)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
