"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import useSWR from "swr";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  });

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
  tags: string[];
  notes: string | null;
  starred_at: string;
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
  totalRepos: number;
  unchanged: boolean;
}

export interface UseStarredReposOptions {
  q?: string;
  language?: string[];
  listId?: number | null;
  tag?: string | null;
  sort?: SortOption;
  limit?: number;
}

function buildStarsUrl(opts: UseStarredReposOptions, offset: number): string {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.language?.length) params.set("language", opts.language.join(","));
  if (opts.listId != null) params.set("list_id", String(opts.listId));
  if (opts.tag) params.set("tag", opts.tag);
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
    tag: opts.tag ?? null,
    sort: opts.sort ?? "recently-starred",
  });
}

export function useStarredRepos(opts: UseStarredReposOptions = {}) {
  const limit = opts.limit ?? 50;
  const [allRepos, setAllRepos] = useState<UserRepo[]>([]);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const prevFilterKey = useRef(filterKey(opts));

  // First page via SWR (handles caching, dedup, revalidation)
  const url = buildStarsUrl(opts, 0);
  const { data, error, isLoading, mutate } = useSWR<StarsResponse>(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000 * 5,
  });

  // Reset accumulated repos when filters change or first page data changes
  useEffect(() => {
    const currentKey = filterKey(opts);
    if (currentKey !== prevFilterKey.current) {
      prevFilterKey.current = currentKey;
      setAllRepos([]);
      setOffset(0);
    }
  }, [opts]);

  // Sync first page data into allRepos
  useEffect(() => {
    if (data?.repos) {
      if (offset === 0) {
        setAllRepos(data.repos);
      }
    }
  }, [data, offset]);

  const total = data?.total ?? 0;
  const hasMore = allRepos.length < total;

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const nextOffset = allRepos.length;
    setLoadingMore(true);
    try {
      const nextUrl = buildStarsUrl(opts, nextOffset);
      const res = await fetch(nextUrl);
      if (!res.ok) throw new Error(`${res.status}`);
      const page: StarsResponse = await res.json();
      setAllRepos((prev) => [...prev, ...page.repos]);
      setOffset(nextOffset);
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
      setAllRepos([]);
      setOffset(0);
      mutate();
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
    isLoading,
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
