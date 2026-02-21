"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Collection {
  id: number;
  user_id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
}

export function useCollections() {
  const { data, error, isLoading, mutate } = useSWR<Collection[]>("/api/collections", fetcher);

  const createCollection = async (name: string, description?: string) => {
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    const collection = await res.json();
    mutate();
    return collection;
  };

  const deleteCollection = async (slug: string) => {
    await fetch(`/api/collections/${slug}`, { method: "DELETE" });
    mutate();
  };

  return { collections: data ?? [], error, isLoading, createCollection, deleteCollection, mutate };
}
