"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Tag {
  id: number;
  user_id: string;
  name: string;
  color: string;
}

export function useTags() {
  const { data, error, isLoading, mutate } = useSWR<Tag[]>("/api/tags", fetcher);

  const createTag = async (name: string, color: string) => {
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    const tag = await res.json();
    mutate();
    return tag;
  };

  const deleteTag = async (id: number) => {
    await fetch(`/api/tags/${id}`, { method: "DELETE" });
    mutate();
  };

  return { tags: data ?? [], error, isLoading, createTag, deleteTag, mutate };
}
