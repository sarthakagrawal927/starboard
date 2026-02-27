"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useRepoTags() {
  const { data, error, isLoading, mutate } = useSWR<Record<number, string[]>>(
    "/api/repo-tags",
    fetcher
  );

  const setTags = async (repoId: number, tags: string[]) => {
    mutate(
      (prev) => ({ ...prev, [repoId]: tags }),
      false
    );
    await fetch(`/api/repos/${repoId}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    });
    mutate();
  };

  const addTag = async (repoId: number, tag: string) => {
    const current = data?.[repoId] ?? [];
    if (!current.includes(tag)) {
      await setTags(repoId, [...current, tag]);
    }
  };

  const removeTag = async (repoId: number, tag: string) => {
    const current = data?.[repoId] ?? [];
    await setTags(repoId, current.filter((t) => t !== tag));
  };

  const getTagsForRepo = (repoId: number): string[] => {
    return data?.[repoId] ?? [];
  };

  return { repoTagMap: data ?? {}, error, isLoading, setTags, addTag, removeTag, getTagsForRepo, mutate };
}
