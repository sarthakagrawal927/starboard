"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { parseAsArrayOf, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { Suspense, useCallback, useEffect, useState } from "react";

import { RepoGrid } from "@/components/repo-grid";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useDiscoverRepos } from "@/hooks/use-discover-repos";
import { useLists } from "@/hooks/use-lists";

const sortOptions = ["relevance", "most-stars", "recently-updated", "name-az"] as const;

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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

export default function DiscoverPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DiscoverContent />
    </Suspense>
  );
}

function DiscoverContent() {
  const { status } = useSession();
  const router = useRouter();

  if (status === "unauthenticated") {
    router.replace("/");
  }

  const [searchQuery, setSearchQuery] = useQueryState("q", parseAsString.withDefault(""));
  const [sortBy, setSortBy] = useQueryState("sort", parseAsStringLiteral(sortOptions).withDefault("most-stars"));
  const [selectedLanguages, setSelectedLanguages] = useQueryState("lang", parseAsArrayOf(parseAsString, ",").withDefault([]));
  const [selectedListId, setSelectedListId] = useQueryState("list", {
    parse: (v) => (v ? parseInt(v, 10) : null),
    serialize: (v) => (v != null ? String(v) : ""),
    defaultValue: null,
  });

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const { repos, total, facets, isLoading: reposLoading, isValidating, loadingMore, hasMore, loadMore, mutate } = useDiscoverRepos({
    q: debouncedSearch,
    language: selectedLanguages,
    listId: selectedListId,
    sort: sortBy,
    limit: 50,
  });
  const { lists, isLoading: listsLoading, createList, deleteList, shareList, assignRepoToList } = useLists();
  const requestKey = [
    debouncedSearch,
    selectedLanguages.join(","),
    selectedListId ?? "",
    sortBy,
  ].join("|");
  const [settledRequestKey, setSettledRequestKey] = useState(requestKey);

  useEffect(() => {
    if (reposLoading || isValidating) return;
    const timeout = window.setTimeout(() => {
      setSettledRequestKey(requestKey);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [isValidating, reposLoading, requestKey]);

  const showSidebarSkeleton =
    (reposLoading || listsLoading) &&
    lists.length === 0 &&
    facets.languages.length === 0;

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    selectedLanguages.length > 0 ||
    selectedListId !== null;
  const isGridPending =
    searchQuery !== debouncedSearch ||
    requestKey !== settledRequestKey ||
    isValidating;

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedLanguages([]);
    setSelectedListId(null);
  }, [setSearchQuery, setSelectedLanguages, setSelectedListId]);

  const handleLanguageToggle = useCallback((language: string) => {
    setSelectedLanguages((prev) =>
      (prev ?? []).includes(language)
        ? (prev ?? []).filter((l) => l !== language)
        : [...(prev ?? []), language]
    );
  }, [setSelectedLanguages]);

  const handleAssignList = useCallback(async (repoId: number, listId: number, assigned: boolean) => {
    await assignRepoToList(repoId, listId, assigned);
    mutate();
  }, [assignRepoToList, mutate]);

  const handleToggleSave = useCallback(async (repoId: number, saved: boolean) => {
    await fetch(`/api/repos/${repoId}/save`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saved }),
    });
    mutate();
  }, [mutate]);

  const handleDeleteList = useCallback(async (id: number) => {
    await deleteList(id);
    if (selectedListId === id) {
      setSelectedListId(null);
    }
    mutate();
  }, [deleteList, mutate, selectedListId, setSelectedListId]);

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
      isLoading={showSidebarSkeleton}
      selectedLanguages={selectedLanguages}
      onLanguageToggle={handleLanguageToggle}
      lists={lists}
      selectedListId={selectedListId}
      onListSelect={setSelectedListId}
      onCreateList={createList}
      onDeleteList={handleDeleteList}
      onShareList={shareList}
    />
  );

  return (
    <>
      <TopBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        onSortChange={(sort) => {
          if (sort !== "recently-starred") setSortBy(sort);
        }}
        sortOptions={sortOptions}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onMenuClick={() => setSidebarOpen(true)}
        repoCount={total}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      />

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[280px] shrink-0 border-r md:block">
          {sidebarContent}
        </aside>

        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-[280px] p-0">
            <SheetTitle className="sr-only">Filters</SheetTitle>
            <SheetDescription className="sr-only">
              Filter seeded repositories by language and collection.
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
              isPending={isGridPending}
              isValidating={isValidating}
              lists={lists}
              onAssignList={handleAssignList}
              onToggleSave={handleToggleSave}
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
