"use client";

import { useCallback, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useStarredRepos } from "@/hooks/use-starred-repos";
import { useTags } from "@/hooks/use-tags";
import { useRepoTags } from "@/hooks/use-repo-tags";
import { categories } from "@/lib/categories";
import { TopBar, type SortOption } from "@/components/top-bar";
import { Sidebar } from "@/components/sidebar";
import { RepoGrid } from "@/components/repo-grid";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

function PageSkeleton() {
  return (
    <>
      {/* Top bar skeleton */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur-sm md:px-6">
        <Skeleton className="h-9 flex-1 rounded-md" />
        <Skeleton className="hidden h-8 w-36 rounded-md sm:block" />
        <Skeleton className="hidden h-8 w-20 rounded-md sm:block" />
        <Skeleton className="size-8 rounded-full" />
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar skeleton */}
        <aside className="hidden w-[280px] shrink-0 border-r md:block">
          <div className="flex flex-col gap-1 p-4">
            {Array.from({ length: 3 }).map((_, section) => (
              <div key={section}>
                <div className="flex items-center gap-2 px-2 py-1">
                  <Skeleton className="size-4" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <div className="mt-1 flex flex-col gap-0.5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2.5 px-2 py-1.5">
                      <Skeleton className="h-3 flex-1" />
                      <Skeleton className="h-3 w-6" />
                    </div>
                  ))}
                </div>
                {section < 2 && <div className="my-3 h-px bg-border" />}
              </div>
            ))}
          </div>
        </aside>

        {/* Main content skeleton */}
        <div className="flex-1 p-4 md:p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col rounded-lg border bg-card p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="size-6 rounded-full" />
                  <Skeleton className="h-4 w-36" />
                </div>
                <Skeleton className="mt-3 h-3 w-full" />
                <Skeleton className="mt-1.5 h-3 w-3/4" />
                <div className="mt-auto pt-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default function StarsPage() {
  const { status } = useSession();
  const router = useRouter();

  // Redirect to home if not authenticated
  if (status === "unauthenticated") {
    router.replace("/");
  }

  // Data hooks
  const { repos, fetchedAt, isLoading: reposLoading, syncing, sync, syncResult, dismissSyncResult } = useStarredRepos();
  const { tags, isLoading: tagsLoading, createTag } = useTags();
  const { repoTagMap, assignTag, removeTag } = useRepoTags();

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recently-starred");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      searchQuery.trim().length > 0 ||
      selectedLanguages.length > 0 ||
      selectedCategory !== null ||
      selectedTagId !== null
    );
  }, [searchQuery, selectedLanguages, selectedCategory, selectedTagId]);

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedLanguages([]);
    setSelectedCategory(null);
    setSelectedTagId(null);
  }, []);

  // Filter and sort repos
  const filteredRepos = useMemo(() => {
    let result = [...repos];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((repo) => {
        const searchable =
          `${repo.name} ${repo.full_name} ${repo.description ?? ""} ${repo.topics.join(" ")}`.toLowerCase();
        return searchable.includes(q);
      });
    }

    // Language filter
    if (selectedLanguages.length > 0) {
      result = result.filter(
        (repo) => repo.language && selectedLanguages.includes(repo.language)
      );
    }

    // Category filter
    if (selectedCategory) {
      const cat = categories.find((c) => c.slug === selectedCategory);
      if (cat) {
        result = result.filter(cat.match);
      }
    }

    // Tag filter
    if (selectedTagId !== null) {
      result = result.filter((repo) => {
        const tagIds = repoTagMap[repo.id] ?? [];
        return tagIds.includes(selectedTagId);
      });
    }

    // Sort
    switch (sortBy) {
      case "most-stars":
        result.sort((a, b) => b.stargazers_count - a.stargazers_count);
        break;
      case "recently-updated":
        result.sort(
          (a, b) =>
            new Date(b.updated_at).getTime() -
            new Date(a.updated_at).getTime()
        );
        break;
      case "name-az":
        result.sort((a, b) =>
          a.full_name.toLowerCase().localeCompare(b.full_name.toLowerCase())
        );
        break;
      case "recently-starred":
      default:
        // Already in order from API (recently starred first)
        break;
    }

    return result;
  }, [repos, searchQuery, selectedLanguages, selectedCategory, selectedTagId, repoTagMap, sortBy]);

  const handleLanguageToggle = useCallback((language: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(language)
        ? prev.filter((l) => l !== language)
        : [...prev, language]
    );
  }, []);

  // Loading/auth state
  if (status === "loading") {
    return <PageSkeleton />;
  }

  if (status === "unauthenticated") {
    return null;
  }

  const sidebarContent = (
    <Sidebar
      repos={repos}
      isLoading={reposLoading || tagsLoading}
      selectedLanguages={selectedLanguages}
      onLanguageToggle={handleLanguageToggle}
      selectedCategory={selectedCategory}
      onCategorySelect={setSelectedCategory}
      tags={tags}
      selectedTagId={selectedTagId}
      onTagSelect={setSelectedTagId}
      onCreateTag={createTag}
    />
  );

  return (
    <>
      <TopBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        onSortChange={setSortBy}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onMenuClick={() => setSidebarOpen(true)}
        repoCount={filteredRepos.length}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        syncing={syncing}
        onSync={sync}
        fetchedAt={fetchedAt}
      />

      {/* Sync result banner */}
      {syncResult && !syncResult.unchanged && (
        <div className="border-b bg-card px-4 py-3 md:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="text-sm">
              <p className="font-medium">Sync complete</p>
              {syncResult.added.length > 0 && (
                <p className="mt-1 text-green-500">
                  + {syncResult.added.length} new: {syncResult.added.map((r) => r.full_name).join(", ")}
                </p>
              )}
              {syncResult.removed.length > 0 && (
                <p className="mt-1 text-red-400">
                  - {syncResult.removed.length} unstarred: {syncResult.removed.map((r) => r.full_name).join(", ")}
                </p>
              )}
            </div>
            <button
              onClick={dismissSyncResult}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Empty state: no cache yet */}
      {!reposLoading && repos.length === 0 && !fetchedAt && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-lg font-medium">No stars synced yet</p>
          <p className="text-sm text-muted-foreground">
            Click Sync to fetch your GitHub starred repos.
          </p>
          <button
            onClick={sync}
            disabled={syncing}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {syncing ? "Syncing..." : "Sync now"}
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden w-[280px] shrink-0 border-r md:block">
          {sidebarContent}
        </aside>

        {/* Mobile sidebar sheet */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-[280px] p-0">
            <SheetTitle className="sr-only">Filters</SheetTitle>
            <SheetDescription className="sr-only">
              Filter starred repositories by language, category, tags, and
              collections.
            </SheetDescription>
            {sidebarContent}
          </SheetContent>
        </Sheet>

        {/* Main content */}
        <ScrollArea className="flex-1">
          <main className="p-4 md:p-6">
            <RepoGrid
              repos={filteredRepos}
              viewMode={viewMode}
              isLoading={reposLoading}
              tags={tags}
              repoTagMap={repoTagMap}
              onAssignTag={assignTag}
              onRemoveTag={removeTag}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={clearFilters}
            />
          </main>
        </ScrollArea>
      </div>
    </>
  );
}
