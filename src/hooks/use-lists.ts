"use client";

import useSWR from "swr";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  });

export interface UserList {
  id: number;
  user_id: string;
  name: string;
  color: string;
  icon: string | null;
  position: number;
  is_public: number; // 0 or 1 (SQLite integer)
  slug: string | null;
  description: string | null;
  created_at: string;
}

export function useLists() {
  const { data, error, isLoading, mutate } = useSWR<UserList[]>("/api/lists", fetcher);

  const createList = async (name: string, color?: string) => {
    const res = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    const list = await res.json();
    mutate();
    return list;
  };

  const updateList = async (id: number, updates: Partial<Pick<UserList, "name" | "color" | "icon" | "position">>) => {
    await fetch(`/api/lists/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    mutate();
  };

  const deleteList = async (id: number) => {
    await fetch(`/api/lists/${id}`, { method: "DELETE" });
    mutate();
  };

  const assignRepoToList = async (repoId: number, listId: number | null) => {
    await fetch(`/api/repos/${repoId}/list`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listId }),
    });
  };

  const shareList = async (id: number) => {
    const res = await fetch(`/api/lists/${id}/share`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to toggle share");
    const result = await res.json();
    mutate();
    return result as { is_public: boolean; slug: string };
  };

  return { lists: data ?? [], error, isLoading, createList, updateList, deleteList, assignRepoToList, shareList, mutate };
}
