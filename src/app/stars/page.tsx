"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useQueryState, parseAsString, parseAsStringLiteral, parseAsArrayOf } from "nuqs";
import { useStarredRepos, type SortOption } from "@/hooks/use-starred-repos";
import { useLists } from "@/hooks/use-lists";
import { useRepoTags } from "@/hooks/use-repo-tags";
import { TopBar } from "@/components/top-bar";
import { Sidebar } from "@/components/sidebar";
import { RepoGrid } from "@/components/repo-grid";
import { SyncAnimation, SyncProgressBar } from "@/components/sync-animation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

const sortOptions = ["recently-starred", "most-stars", "recently-updated", "name-az"] as const;

function PageSkeleton() {
  return (
    <>
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur-sm md:px-6">
        <Skeleton className="h-9 flex-1 rounded-md" />
        <Skeleton className="hidden h-8 w-36 rounded-md sm:block" />
        <Skeleton className="hidden h-8 w-20 rounded-md sm:block" />
        <Skeleton className="size-8 rounded-full" />
      </header>

      <div className="flex min-h-0 flex-1">
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
  return (
    <Suspense fallback={<PageSkeleton />}>
      <StarsContent />
    </Suspense>
  );
}

function StarsContent() {
  const { status } = useSession();
  const router = useRouter();

  if (status === "unauthenticated") {
    router.replace("/");
  }

  // URL-synced filter state via nuqs
  const [searchQuery, setSearchQuery] = useQueryState("q", parseAsString.withDefault(""));
  const [sortBy, setSortBy] = useQueryState("sort", parseAsStringLiteral(sortOptions).withDefault("recently-starred"));
  const [selectedLanguages, setSelectedLanguages] = useQueryState("lang", parseAsArrayOf(parseAsString, ",").withDefault([]));
  const [selectedListId, setSelectedListId] = useQueryState("list", {
    parse: (v) => (v ? parseInt(v, 10) : null),
    serialize: (v) => (v != null ? String(v) : ""),
    defaultValue: null,
  });
  const [selectedTag, setSelectedTag] = useQueryState("tag", parseAsString.withDefault("").withOptions({ clearOnDefault: true }));

  // Local-only state
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Data hooks
  const { repos, total, facets, isLoading: reposLoading, loadingMore, hasMore, loadMore, syncing, sync, syncResult, dismissSyncResult, mutate } = useStarredRepos({
    q: debouncedSearch,
    language: selectedLanguages,
    listId: selectedListId,
    tag: selectedTag || null,
    sort: sortBy,
    limit: 50,
  });
  const { lists, isLoading: listsLoading, createList, shareList, assignRepoToList } = useLists();
  const { repoTagMap, addTag, removeTag } = useRepoTags(repos, mutate);

  // Track whether we've loaded data at least once (to avoid showing sidebar skeleton on filter changes)
  const hasLoadedOnce = useRef(false);
  if (!reposLoading && !listsLoading) {
    hasLoadedOnce.current = true;
  }
  const showSidebarSkeleton = !hasLoadedOnce.current && (reposLoading || listsLoading);

  const allTags = facets.tags.map(([tag]) => tag);

  const hasActiveFilters = searchQuery.trim().length > 0 || selectedLanguages.length > 0 || selectedListId !== null || (selectedTag !== null && selectedTag !== "");

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedLanguages([]);
    setSelectedListId(null);
    setSelectedTag("");
  }, [setSearchQuery, setSelectedLanguages, setSelectedListId, setSelectedTag]);

  const handleLanguageToggle = useCallback((language: string) => {
    setSelectedLanguages((prev) =>
      (prev ?? []).includes(language)
        ? (prev ?? []).filter((l) => l !== language)
        : [...(prev ?? []), language]
    );
  }, [setSelectedLanguages]);

  const handleListSelect = useCallback((id: number | null) => {
    setSelectedListId(id);
  }, [setSelectedListId]);

  const handleAssignList = useCallback(async (repoId: number, listId: number | null) => {
    await assignRepoToList(repoId, listId);
    mutate();
  }, [assignRepoToList, mutate]);

  const handleTagSelect = useCallback((tag: string | null) => {
    setSelectedTag(tag ?? "");
  }, [setSelectedTag]);

  if (status === "loading") {
    return <PageSkeleton />;
  }

  if (status === "unauthenticated") {
    return null;
  }

  const sidebarContent = (
    <Sidebar
      languageFacets={facets.languages}
      listFacets={facets.lists}
      tagFacets={facets.tags}
      isLoading={showSidebarSkeleton}
      selectedLanguages={selectedLanguages}
      onLanguageToggle={handleLanguageToggle}
      lists={lists}
      selectedListId={selectedListId}
      onListSelect={handleListSelect}
      onCreateList={createList}
      onShareList={shareList}
      selectedTag={selectedTag || null}
      onTagSelect={handleTagSelect}
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
        repoCount={total}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        syncing={syncing}
        onSync={sync}
      />

      {/* Progress bar for syncs when repos already loaded */}
      {syncing && total > 0 && <SyncProgressBar />}

      {syncResult && !syncResult.unchanged && (
        <div
          className="border-b bg-card px-4 py-3 md:px-6"
          style={{ animation: "slideDown 0.3s ease both" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="text-sm">
              <p className="font-medium">Sync complete</p>
              {syncResult.added.length > 0 && (
                <p className="mt-1 text-green-500">
                  +{syncResult.added.length} new: {syncResult.added.map((r) => r.full_name).join(", ")}
                </p>
              )}
              {syncResult.removed.length > 0 && (
                <p className="mt-1 text-red-400">
                  -{syncResult.removed.length} removed: {syncResult.removed.map((r) => r.full_name).join(", ")}
                </p>
              )}
              {syncResult.unchanged && (
                <p className="mt-1 text-muted-foreground">Everything up to date</p>
              )}
            </div>
            <button
              onClick={dismissSyncResult}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              &times;
            </button>
          </div>
          <style>{`
            @keyframes slideDown {
              from { opacity: 0; transform: translateY(-8px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}

      {/* Initial import: full animated screen */}
      {!reposLoading && total === 0 && !hasActiveFilters && syncing && (
        <SyncAnimation />
      )}

      {!reposLoading && total === 0 && !hasActiveFilters && !syncing && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <svg viewBox="0 0 24 24" className="size-12 fill-muted-foreground/30" aria-hidden="true">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <p className="text-lg font-medium">No stars synced yet</p>
          <p className="text-sm text-muted-foreground">
            Fetch your GitHub starred repos to get started.
          </p>
          <button
            onClick={sync}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Sync now
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[280px] shrink-0 border-r md:block">
          {sidebarContent}
        </aside>

        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-[280px] p-0">
            <SheetTitle className="sr-only">Filters</SheetTitle>
            <SheetDescription className="sr-only">
              Filter starred repositories by language, list, and tags.
            </SheetDescription>
            {sidebarContent}
          </SheetContent>
        </Sheet>

        <ScrollArea className="flex-1">
          <main className="p-4 md:p-6">
            <RepoGrid
              repos={repos}
              viewMode={viewMode}
              isLoading={reposLoading}
              repoTagMap={repoTagMap}
              allTags={allTags}
              onAddTag={addTag}
              onRemoveTag={removeTag}
              lists={lists}
              onAssignList={handleAssignList}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={clearFilters}
              hasMore={hasMore}
              loadingMore={loadingMore}
              onLoadMore={loadMore}
            />
          </main>
        </ScrollArea>
      </div>
    </>
  );
}
