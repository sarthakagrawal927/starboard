"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";

export type SortOption = "recently-starred" | "most-stars" | "recently-updated" | "name-az";

// Map frontend sort names to API sort params
const sortMap: Record<SortOption, string> = {
  "recently-starred": "starred",
  "most-stars": "stars",
  "recently-updated": "updated",
  "name-az": "name",
};

export interface UserRepo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string; avatar_url: string };
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  topics: string[];
  created_at: string;
  updated_at: string;
  list_id: number | null;
  collection_ids: number[];
  tags: string[];
  notes: string | null;
  starred_at: string | null;
  is_starred?: boolean;
  is_saved?: boolean;
}

export interface Facets {
  languages: [string, number][];
  lists: { id: number; name: string; color: string; count: number }[];
  tags: [string, number][];
}

interface StarsResponse {
  repos: UserRepo[];
  total: number;
  facets: Facets;
}

export interface SyncResult {
  added: { id: number; full_name: string; description: string | null }[];
  removed: { id: number; full_name: string; description: string | null }[];
  importedLists: string[];
  assignedRepos: number;
  totalRepos: number;
  unchanged: boolean;
}

export interface UseStarredReposOptions {
  q?: string;
  language?: string[];
  listId?: number | null;
  sort?: SortOption;
  limit?: number;
}

function buildStarsUrl(opts: UseStarredReposOptions, offset: number): string {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.language?.length) params.set("language", opts.language.join(","));
  if (opts.listId != null) params.set("list_id", String(opts.listId));
  const apiSort = sortMap[opts.sort ?? "recently-starred"];
  if (apiSort !== "starred") params.set("sort", apiSort);
  const limit = opts.limit ?? 50;
  if (limit !== 50) params.set("limit", String(limit));
  if (offset > 0) params.set("offset", String(offset));
  const qs = params.toString();
  return `/api/stars${qs ? `?${qs}` : ""}`;
}

// Serialize filter options to a stable key for detecting filter changes
function filterKey(opts: UseStarredReposOptions): string {
  return JSON.stringify({
    q: opts.q ?? "",
    lang: opts.language ?? [],
    list: opts.listId ?? null,
    sort: opts.sort ?? "recently-starred",
  });
}

export function useStarredRepos(opts: UseStarredReposOptions = {}) {
  const { mutate: globalMutate } = useSWRConfig();
  const [loadedRepos, setLoadedRepos] = useState<UserRepo[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const prevFilterKey = useRef(filterKey(opts));
  const searchAbortRef = useRef<AbortController | null>(null);
  const loadMoreAbortRef = useRef<AbortController | null>(null);

  // First page via SWR
  const url = buildStarsUrl(opts, 0);
  const { data, error, isLoading, isValidating, mutate } = useSWR<StarsResponse>(
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
        // Don't let SWR retry aborted requests
        if (err?.name === "AbortError") return;
      },
    }
  );

  // Abort stale requests and reset pagination when filters change
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
      const nextUrl = buildStarsUrl(opts, nextOffset);
      const res = await fetch(nextUrl, { signal: loadMoreAbortRef.current.signal });
      if (!res.ok) throw new Error(`${res.status}`);
      const page: StarsResponse = await res.json();
      setLoadedRepos((prev) => [...prev, ...page.repos]);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      throw e;
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, allRepos.length, opts]);

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const sync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/stars/sync", { method: "POST" });
      const result: SyncResult = await res.json();
      setSyncResult(result);
      setLoadedRepos([]);
      await Promise.all([mutate(), globalMutate("/api/lists")]);
      // Auto-generate embeddings for all repos missing them
      fetch("/api/embeddings/generate", { method: "POST" }).catch(() => {});
      return result;
    } finally {
      setSyncing(false);
    }
  };

  const dismissSyncResult = () => setSyncResult(null);

  return {
    repos: allRepos,
    total,
    facets: data?.facets ?? { languages: [], lists: [], tags: [] },
    error,
    isLoading: isLoading && allRepos.length === 0,
    isValidating,
    loadingMore,
    hasMore,
    loadMore,
    syncing,
    sync,
    syncResult,
    dismissSyncResult,
    mutate,
  };
}
