"use client";

import { useState } from "react";
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
  offset?: number;
}

function buildStarsUrl(opts: UseStarredReposOptions): string {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.language?.length) params.set("language", opts.language.join(","));
  if (opts.listId != null) params.set("list_id", String(opts.listId));
  if (opts.tag) params.set("tag", opts.tag);
  const apiSort = sortMap[opts.sort ?? "recently-starred"];
  if (apiSort !== "starred") params.set("sort", apiSort);
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.offset) params.set("offset", String(opts.offset));
  const qs = params.toString();
  return `/api/stars${qs ? `?${qs}` : ""}`;
}

export function useStarredRepos(opts: UseStarredReposOptions = {}) {
  const url = buildStarsUrl(opts);
  const { data, error, isLoading, mutate } = useSWR<StarsResponse>(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000 * 5,
    keepPreviousData: true,
  });

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const sync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/stars/sync", { method: "POST" });
      const result: SyncResult = await res.json();
      setSyncResult(result);
      mutate();
      return result;
    } finally {
      setSyncing(false);
    }
  };

  const dismissSyncResult = () => setSyncResult(null);

  return {
    repos: data?.repos ?? [],
    total: data?.total ?? 0,
    facets: data?.facets ?? { languages: [], lists: [], tags: [] },
    error,
    isLoading,
    syncing,
    sync,
    syncResult,
    dismissSyncResult,
    mutate,
  };
}
