"use client";

import useSWR from "swr";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  });

interface RepoDetail {
  repo: {
    id: number;
    name: string;
    full_name: string;
    owner_login: string;
    owner_avatar: string;
    html_url: string;
    description: string | null;
    language: string | null;
    stargazers_count: number;
    topics: string[];
    repo_created_at: string | null;
    repo_updated_at: string | null;
  };
  likeCount: number;
  commentCount: number;
  userLiked: boolean;
}

interface Comment {
  id: number;
  body: string;
  created_at: string;
  user: { id: string; username: string; avatar_url: string | null };
}

/**
 * Accepts owner/repo slug (e.g. "vercel/next.js").
 * Resolves to numeric ID via the lookup API, then uses numeric ID for sub-routes.
 */
export function useRepoDetail(slug: string) {
  const { data, error, isLoading, mutate } = useSWR<RepoDetail>(
    slug ? `/api/repos/lookup?name=${encodeURIComponent(slug)}` : null,
    fetcher
  );

  const repoId = data?.repo.id;

  const { data: comments, mutate: mutateComments } = useSWR<Comment[]>(
    repoId ? `/api/repos/${repoId}/comments` : null,
    fetcher
  );

  const toggleLike = async () => {
    if (!repoId) return;
    const res = await fetch(`/api/repos/${repoId}/likes`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to toggle like");
    const result = await res.json();
    mutate();
    return result;
  };

  const addComment = async (body: string) => {
    if (!repoId) return;
    const res = await fetch(`/api/repos/${repoId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) throw new Error("Failed to post comment");
    mutateComments();
    mutate();
  };

  return {
    repo: data?.repo ?? null,
    likeCount: data?.likeCount ?? 0,
    commentCount: data?.commentCount ?? 0,
    userLiked: data?.userLiked ?? false,
    comments: comments ?? [],
    isLoading,
    error,
    toggleLike,
    addComment,
  };
}
