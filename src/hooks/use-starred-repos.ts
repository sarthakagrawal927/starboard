"use client";

import { useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

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

interface StarsResponse {
  repos: UserRepo[];
  fetchedAt: string | null;
}

export interface SyncResult {
  added: { id: number; full_name: string; description: string | null }[];
  removed: { id: number; full_name: string; description: string | null }[];
  totalRepos: number;
  unchanged: boolean;
}

export function useStarredRepos() {
  const { data, error, isLoading, mutate } = useSWR<StarsResponse>("/api/stars", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000 * 5,
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
    fetchedAt: data?.fetchedAt ?? null,
    error,
    isLoading,
    syncing,
    sync,
    syncResult,
    dismissSyncResult,
    mutate,
  };
}
