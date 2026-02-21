"use client";

import { useCallback, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useStarredRepos } from "@/hooks/use-starred-repos";
import { useTags } from "@/hooks/use-tags";
import { useCollections } from "@/hooks/use-collections";
import { categories } from "@/lib/categories";
import { TopBar, type SortOption } from "@/components/top-bar";
import { Sidebar } from "@/components/sidebar";
import { RepoGrid } from "@/components/repo-grid";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

export default function StarsPage() {
  const { status } = useSession();
  const router = useRouter();

  // Redirect to home if not authenticated
  if (status === "unauthenticated") {
    router.replace("/");
  }

  // Data hooks
  const { repos, isLoading: reposLoading } = useStarredRepos();
  const { tags, createTag } = useTags();
  const { collections, createCollection } = useCollections();

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recently-starred");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<
    number | null
  >(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
  }, [repos, searchQuery, selectedLanguages, selectedCategory, sortBy]);

  const handleLanguageToggle = useCallback((language: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(language)
        ? prev.filter((l) => l !== language)
        : [...prev, language]
    );
  }, []);

  // Loading/auth state
  if (status === "loading") {
    return (
      <div className="flex h-svh items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  const sidebarContent = (
    <Sidebar
      repos={repos}
      selectedLanguages={selectedLanguages}
      onLanguageToggle={handleLanguageToggle}
      selectedCategory={selectedCategory}
      onCategorySelect={setSelectedCategory}
      tags={tags}
      selectedTagId={selectedTagId}
      onTagSelect={setSelectedTagId}
      collections={collections}
      selectedCollectionId={selectedCollectionId}
      onCollectionSelect={setSelectedCollectionId}
      onCreateTag={createTag}
      onCreateCollection={createCollection}
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
      />

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
              collections={collections}
            />
          </main>
        </ScrollArea>
      </div>
    </>
  );
}
