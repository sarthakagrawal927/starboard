"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useRepoDetail } from "@/hooks/use-repo-detail";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Heart,
  MessageSquare,
  Star,
  ExternalLink,
  ArrowLeft,
} from "lucide-react";

const languageColors: Record<string, string> = {
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  Python: "#3572A5",
  Rust: "#dea584",
  Go: "#00ADD8",
  Java: "#b07219",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  Ruby: "#701516",
  PHP: "#4F5D95",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Dart: "#00B4AB",
  Shell: "#89e051",
  Elixir: "#6e4a7e",
  Haskell: "#5e5086",
  Zig: "#ec915c",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Vue: "#41b883",
  Svelte: "#ff3e00",
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatStarCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}k`;
  }
  return count.toString();
}

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <Skeleton className="mb-6 h-8 w-20" />
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-5 w-48" />
        </div>
        <Skeleton className="mt-4 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-3/4" />
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <Skeleton className="mt-6 h-px w-full" />
        <div className="mt-4 flex gap-6">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
      </div>
    </div>
  );
}

export default function RepoDetailPage() {
  const params = useParams();
  const slugParts = params.slug as string[];
  const repoSlug = slugParts?.length === 2 ? `${slugParts[0]}/${slugParts[1]}` : "";
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  const {
    repo,
    likeCount,
    commentCount,
    userLiked,
    comments,
    isLoading,
    error,
    toggleLike,
    addComment,
  } = useRepoDetail(repoSlug);

  const [commentBody, setCommentBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [liking, setLiking] = useState(false);

  const handleLike = async () => {
    if (!isAuthenticated || liking) return;
    setLiking(true);
    try {
      await toggleLike();
    } finally {
      setLiking(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim() || submitting) return;
    setSubmitting(true);
    try {
      await addComment(commentBody.trim());
      setCommentBody("");
    } finally {
      setSubmitting(false);
    }
  };

  if (!repoSlug) {
    return (
      <div className="mx-auto max-w-3xl p-4 md:p-6">
        <p className="text-muted-foreground">Invalid repository path. Use /explore/owner/repo</p>
      </div>
    );
  }

  if (isLoading) return <PageSkeleton />;

  if (error || !repo) {
    return (
      <div className="mx-auto max-w-3xl p-4 md:p-6">
        <Link
          href="/stars"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            {error ? "Failed to load repository." : "Repository not found."}
          </p>
        </div>
      </div>
    );
  }

  const isGitHubAvatar = repo.owner_avatar.includes(
    "avatars.githubusercontent.com"
  );
  const langColor = repo.language
    ? languageColors[repo.language] ?? "#8b8b8b"
    : null;

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      {/* Back link */}
      <Link
        href="/stars"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>

      {/* Repo header card */}
      <div className="rounded-lg border bg-card p-6">
        {/* Owner + name */}
        <div className="flex items-center gap-3">
          {isGitHubAvatar ? (
            <Image
              src={repo.owner_avatar}
              alt={repo.owner_login}
              width={32}
              height={32}
              className="size-8 rounded-full"
            />
          ) : (
            <img
              src={repo.owner_avatar}
              alt={repo.owner_login}
              className="size-8 rounded-full"
              loading="lazy"
            />
          )}
          <a
            href={repo.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-lg font-medium hover:underline"
          >
            <span className="text-muted-foreground">{repo.owner_login}/</span>
            {repo.name}
            <ExternalLink className="size-3.5 text-muted-foreground" />
          </a>
        </div>

        {/* Description */}
        {repo.description && (
          <p className="mt-3 leading-relaxed text-muted-foreground">
            {repo.description}
          </p>
        )}

        {/* Language + stars + topics */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {repo.language && (
            <Badge variant="secondary" className="gap-1.5 text-xs font-normal">
              <span
                className="inline-block size-2.5 rounded-full"
                style={{ backgroundColor: langColor ?? undefined }}
              />
              {repo.language}
            </Badge>
          )}
          <Badge variant="secondary" className="gap-1 text-xs font-normal">
            <Star className="size-3 fill-current" />
            {formatStarCount(repo.stargazers_count)}
          </Badge>
          {repo.topics.map((topic) => (
            <Badge
              key={topic}
              variant="outline"
              className="text-xs font-normal"
            >
              {topic}
            </Badge>
          ))}
        </div>

        <Separator className="my-5" />

        {/* Stats bar: likes + comments */}
        <div className="flex items-center gap-6">
          <button
            onClick={handleLike}
            disabled={!isAuthenticated || liking}
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:cursor-default disabled:opacity-50"
          >
            <Heart
              className={`size-4 ${
                userLiked
                  ? "fill-red-500 text-red-500"
                  : ""
              }`}
            />
            <span>{likeCount}</span>
          </button>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MessageSquare className="size-4" />
            <span>{commentCount}</span>
          </div>
        </div>
      </div>

      {/* Comments section */}
      <div className="mt-6">
        <h2 className="mb-4 text-sm font-medium">Comments</h2>

        {comments.length === 0 ? (
          <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
            No comments yet. Be the first!
          </p>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => {
              const commentAvatarIsGH = comment.user.avatar_url?.includes(
                "avatars.githubusercontent.com"
              );
              return (
                <div
                  key={comment.id}
                  className="rounded-lg border bg-card p-4"
                >
                  <div className="flex items-center gap-2">
                    {comment.user.avatar_url ? (
                      commentAvatarIsGH ? (
                        <Image
                          src={comment.user.avatar_url}
                          alt={comment.user.username}
                          width={24}
                          height={24}
                          className="size-6 rounded-full"
                        />
                      ) : (
                        <img
                          src={comment.user.avatar_url}
                          alt={comment.user.username}
                          className="size-6 rounded-full"
                          loading="lazy"
                        />
                      )
                    ) : (
                      <div className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {comment.user.username[0]?.toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm font-medium">
                      {comment.user.username}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(comment.created_at)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed">
                    {comment.body}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Comment input */}
        <div className="mt-4">
          {isAuthenticated ? (
            <form onSubmit={handleSubmitComment} className="space-y-3">
              <textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Write a comment..."
                maxLength={2000}
                rows={3}
                className="w-full resize-none rounded-lg border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={!commentBody.trim() || submitting}
                >
                  {submitting ? "Posting..." : "Post comment"}
                </Button>
              </div>
            </form>
          ) : (
            <p className="rounded-lg border bg-card p-4 text-center text-sm text-muted-foreground">
              Sign in to comment.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
