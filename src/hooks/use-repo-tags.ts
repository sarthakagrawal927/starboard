"use client";

import { useMemo, useCallback } from "react";
import { UserRepo } from "@/hooks/use-starred-repos";
import type { KeyedMutator } from "swr";

export function useRepoTags(repos: UserRepo[], mutateStars: KeyedMutator<any>) {
  const repoTagMap = useMemo(() => {
    const map: Record<number, string[]> = {};
    for (const repo of repos) {
      if (repo.tags.length > 0) map[repo.id] = repo.tags;
    }
    return map;
  }, [repos]);

  const setTags = useCallback(async (repoId: number, tags: string[]) => {
    await fetch(`/api/repos/${repoId}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    });
    mutateStars();
  }, [mutateStars]);

  const addTag = useCallback(async (repoId: number, tag: string) => {
    const current = repoTagMap[repoId] ?? [];
    if (!current.includes(tag)) {
      await setTags(repoId, [...current, tag]);
    }
  }, [repoTagMap, setTags]);

  const removeTag = useCallback(async (repoId: number, tag: string) => {
    const current = repoTagMap[repoId] ?? [];
    await setTags(repoId, current.filter((t) => t !== tag));
  }, [repoTagMap, setTags]);

  return { repoTagMap, setTags, addTag, removeTag };
}
