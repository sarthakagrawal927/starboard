"use client";

import useSWR from "swr";

export interface SimilarRepo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string; avatar_url: string };
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  topics: string[];
  list_id: number | null;
  collection_ids?: number[];
  tags: string[];
  similarity: number;
}

interface Response {
  similar: SimilarRepo[];
  reason?: string;
}

const fetcher = async <T>(url: string): Promise<T> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json() as Promise<T>;
  });

export function useSimilarRepos(repoId: number | null | undefined, limit = 8) {
  const { data, error, isLoading } = useSWR<Response>(
    repoId ? `/api/repos/${repoId}/similar?limit=${limit}` : null,
    fetcher<Response>,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000 * 10,
    }
  );

  return {
    similar: data?.similar ?? [],
    reason: data?.reason,
    isLoading,
    error,
  };
}
