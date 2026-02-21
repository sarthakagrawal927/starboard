"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useStarredRepos } from "@/hooks/use-starred-repos";
import { useCollections } from "@/hooks/use-collections";
import { RepoCard } from "@/components/repo-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, FolderOpen, Inbox, Trash2 } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Collection {
  id: number;
  user_id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
}

export default function CollectionPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { status } = useSession();
  const slug = params.slug;

  const { repos, isLoading: reposLoading } = useStarredRepos();
  const { deleteCollection } = useCollections();
  const [viewMode] = useState<"grid" | "list">("grid");
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch collection metadata
  const { data: collection, isLoading: collectionLoading } =
    useSWR<Collection>(slug ? `/api/collections/${slug}` : null, fetcher);

  // Fetch repo IDs in this collection
  const {
    data: repoIds,
    isLoading: repoIdsLoading,
    mutate: mutateRepoIds,
  } = useSWR<number[]>(
    slug ? `/api/collections/${slug}/repos` : null,
    fetcher
  );

  // Cross-reference: filter starred repos that are in this collection
  const collectionRepos = useMemo(() => {
    if (!repoIds || repoIds.length === 0) return [];
    const idSet = new Set(repoIds);
    return repos.filter((repo) => idSet.has(repo.id));
  }, [repos, repoIds]);

  async function handleRemoveRepo(repoId: number) {
    await fetch(`/api/collections/${slug}/repos`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoId }),
    });
    mutateRepoIds();
  }

  async function handleDeleteCollection() {
    if (!confirm("Are you sure you want to delete this collection?")) return;
    setIsDeleting(true);
    try {
      await deleteCollection(slug);
      router.push("/stars");
    } catch {
      setIsDeleting(false);
    }
  }

  // Redirect unauthenticated users
  if (status === "unauthenticated") {
    router.replace("/");
    return null;
  }

  if (status === "loading") {
    return (
      <div className="flex h-svh items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const isLoading = collectionLoading || repoIdsLoading || reposLoading;

  return (
    <ScrollArea className="h-svh">
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 gap-1.5"
            onClick={() => router.push("/stars")}
          >
            <ArrowLeft className="size-4" />
            Back to all stars
          </Button>

          {collectionLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96" />
            </div>
          ) : collection ? (
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <FolderOpen className="size-6 text-muted-foreground" />
                  <h1 className="text-2xl font-bold tracking-tight">
                    {collection.name}
                  </h1>
                </div>
                {collection.description && (
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {collection.description}
                  </p>
                )}
                {!isLoading && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {collectionRepos.length}{" "}
                    {collectionRepos.length === 1 ? "repo" : "repos"}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 gap-1.5 text-destructive hover:text-destructive"
                onClick={handleDeleteCollection}
                disabled={isDeleting}
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <h2 className="text-lg font-medium text-foreground">
                Collection not found
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                This collection may have been deleted.
              </p>
            </div>
          )}
        </div>

        {/* Repo list */}
        {isLoading ? (
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
                : "flex flex-col gap-2"
            }
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col rounded-lg border bg-card p-4"
              >
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
        ) : collectionRepos.length === 0 && collection ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Inbox className="mb-4 size-12 text-muted-foreground/50" />
            <h3 className="text-lg font-medium text-foreground">
              This collection is empty
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Add repos to this collection using the folder icon on any repo
              card.
            </p>
          </div>
        ) : (
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
                : "flex flex-col gap-2"
            }
          >
            {collectionRepos.map((repo) => (
              <div key={repo.id} className="group/collection relative">
                <RepoCard repo={repo} viewMode={viewMode} />
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="absolute right-2 top-2 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/collection:opacity-100"
                  onClick={() => handleRemoveRepo(repo.id)}
                  aria-label="Remove from collection"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
