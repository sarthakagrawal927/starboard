"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";

import type { Facets, SortOption, UserRepo } from "@/hooks/use-starred-repos";

const sortMap: Record<SortOption, string> = {
  "recently-starred": "stars",
  "most-stars": "stars",
  "recently-updated": "updated",
  "name-az": "name",
};

interface DiscoverResponse {
  repos: UserRepo[];
  total: number;
  facets: Facets;
  minStars: number;
}

export interface UseDiscoverReposOptions {
  q?: string;
  language?: string[];
  listId?: number | null;
  tag?: string | null;
  sort?: SortOption;
  limit?: number;
}

const EMPTY_FACETS: Facets = {
  languages: [],
  lists: [],
  tags: [],
};

function buildDiscoverUrl(opts: UseDiscoverReposOptions, offset: number): string {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.language?.length) params.set("language", opts.language.join(","));
  if (opts.listId != null) params.set("list_id", String(opts.listId));
  if (opts.tag) params.set("tag", opts.tag);
  const apiSort = sortMap[opts.sort ?? "most-stars"];
  if (apiSort !== "stars") params.set("sort", apiSort);
  const limit = opts.limit ?? 50;
  if (limit !== 50) params.set("limit", String(limit));
  if (offset > 0) params.set("offset", String(offset));
  const qs = params.toString();
  return `/api/discover${qs ? `?${qs}` : ""}`;
}

function filterKey(opts: UseDiscoverReposOptions): string {
  return JSON.stringify({
    q: opts.q ?? "",
    lang: opts.language ?? [],
    list: opts.listId ?? null,
    tag: opts.tag ?? null,
    sort: opts.sort ?? "most-stars",
  });
}

export function useDiscoverRepos(opts: UseDiscoverReposOptions = {}) {
  const [loadedRepos, setLoadedRepos] = useState<UserRepo[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const prevFilterKey = useRef(filterKey(opts));
  const searchAbortRef = useRef<AbortController | null>(null);
  const loadMoreAbortRef = useRef<AbortController | null>(null);

  const url = buildDiscoverUrl(opts, 0);
  const { data, error, isLoading, isValidating, mutate } = useSWR<DiscoverResponse>(
    url,
    (url: string) => {
      const controller = new AbortController();
      searchAbortRef.current = controller;
      return fetch(url, { signal: controller.signal }).then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      });
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000 * 5,
      keepPreviousData: true,
      errorRetryCount: 1,
      onError: (err) => {
        if (err?.name === "AbortError") return;
      },
    }
  );

  useEffect(() => {
    const currentKey = filterKey(opts);
    if (currentKey !== prevFilterKey.current) {
      prevFilterKey.current = currentKey;
      searchAbortRef.current?.abort();
      loadMoreAbortRef.current?.abort();
      setLoadedRepos([]);
    }
  }, [opts]);

  const firstPageRepos = data?.repos ?? [];
  const allRepos = [...firstPageRepos, ...loadedRepos];
  const total = data?.total ?? 0;
  const hasMore = allRepos.length < total;

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    loadMoreAbortRef.current?.abort();
    loadMoreAbortRef.current = new AbortController();
    const nextOffset = allRepos.length;
    setLoadingMore(true);
    try {
      const nextUrl = buildDiscoverUrl(opts, nextOffset);
      const res = await fetch(nextUrl, { signal: loadMoreAbortRef.current.signal });
      if (!res.ok) throw new Error(`${res.status}`);
      const page: DiscoverResponse = await res.json();
      setLoadedRepos((prev) => [...prev, ...page.repos]);
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      throw error;
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, allRepos.length, opts]);

  return {
    repos: allRepos,
    total,
    facets: data?.facets ?? EMPTY_FACETS,
    minStars: data?.minStars ?? 5000,
    error,
    isLoading: isLoading && allRepos.length === 0,
    isValidating,
    loadingMore,
    hasMore,
    loadMore,
    mutate,
  };
}
