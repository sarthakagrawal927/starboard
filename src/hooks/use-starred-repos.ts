"use client";

import useSWR from "swr";
import { StarredRepo } from "@/lib/github";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useStarredRepos() {
  const { data, error, isLoading } = useSWR<StarredRepo[]>("/api/stars", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000 * 5, // cache for 5 min
  });

  return { repos: data ?? [], error, isLoading };
}
