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
  commentCount: number;
}

export interface Comment {
  id: number;
  body: string;
  created_at: string;
  upvotes: number;
  downvotes: number;
  userVote: 1 | -1 | null;
  user: { id: string; username: string; avatar_url: string | null };
}

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

  const voteComment = async (commentId: number, value: 1 | -1) => {
    if (!repoId) return;
    const res = await fetch(`/api/repos/${repoId}/comments/${commentId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    if (!res.ok) throw new Error("Failed to vote");
    // Optimistic-ish: just revalidate
    mutateComments();
  };

  return {
    repo: data?.repo ?? null,
    commentCount: data?.commentCount ?? 0,
    comments: comments ?? [],
    isLoading,
    error,
    addComment,
    voteComment,
  };
}
