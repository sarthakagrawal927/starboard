"use client";

import { StarredRepo } from "@/lib/github";
import { RepoCard } from "@/components/repo-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Inbox } from "lucide-react";

interface Tag {
  id: number;
  user_id: string;
  name: string;
  color: string;
}

interface RepoGridProps {
  repos: StarredRepo[];
  viewMode: "grid" | "list";
  isLoading: boolean;
  tags?: Tag[];
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

export function RepoGrid({ repos, viewMode, isLoading, tags }: RepoGridProps) {
  if (isLoading) {
    return (
      <div
        className={
          viewMode === "grid"
            ? "grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
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
        <p className="mt-1 text-sm text-muted-foreground">
          Try adjusting your search or filter criteria.
        </p>
      </div>
    );
  }

  return (
    <div
      className={
        viewMode === "grid"
          ? "grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
          : "flex flex-col gap-2"
      }
    >
      {repos.map((repo) => (
        <RepoCard
          key={repo.id}
          repo={repo}
          viewMode={viewMode}
          allTags={tags}
        />
      ))}
    </div>
  );
}
