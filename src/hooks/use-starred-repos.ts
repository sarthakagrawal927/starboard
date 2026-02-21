"use client";

import { useState } from "react";
import useSWR from "swr";
import { StarredRepo } from "@/lib/github";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface StarsResponse {
  repos: StarredRepo[];
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
