"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Fetches ALL repo-tag assignments in one call
// Returns a map: { [repoId]: tagId[] }
export function useRepoTags() {
  const { data, error, isLoading, mutate } = useSWR<Record<number, number[]>>(
    "/api/repo-tags",
    fetcher
  );

  const assignTag = async (repoId: number, tagId: number) => {
    // Optimistic update
    mutate(
      (prev) => {
        if (!prev) return { [repoId]: [tagId] };
        const existing = prev[repoId] ?? [];
        return { ...prev, [repoId]: [...existing, tagId] };
      },
      false
    );
    await fetch(`/api/repos/${repoId}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId }),
    });
    mutate();
  };

  const removeTag = async (repoId: number, tagId: number) => {
    // Optimistic update
    mutate(
      (prev) => {
        if (!prev) return {};
        const existing = prev[repoId] ?? [];
        return { ...prev, [repoId]: existing.filter((id) => id !== tagId) };
      },
      false
    );
    await fetch(`/api/repos/${repoId}/tags`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId }),
    });
    mutate();
  };

  const getTagIdsForRepo = (repoId: number): number[] => {
    return data?.[repoId] ?? [];
  };

  return { repoTagMap: data ?? {}, error, isLoading, assignTag, removeTag, getTagIdsForRepo, mutate };
}
