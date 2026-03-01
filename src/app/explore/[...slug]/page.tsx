"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRepoDetail } from "@/hooks/use-repo-detail";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { getAvatarImageAttrs } from "@/lib/avatar";
import {
  MessageSquare,
  Star,
  ExternalLink,
  ArrowLeft,
  ThumbsUp,
  ThumbsDown,
  Calendar,
  GitFork,
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
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function formatStarCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}k`;
  }
  return count.toString();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <Skeleton className="mb-6 h-8 w-20" />
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="mt-1.5 h-3.5 w-28" />
            </div>
          </div>
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
        <Skeleton className="mt-4 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-3/4" />
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div className="mt-6 flex gap-4 border-t pt-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      <div className="mt-6 space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2">
              <Skeleton className="size-6 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-1.5 h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RepoDetailPage() {
  const params = useParams();
  const slugParts = params.slug as string[];
  const repoSlug =
    slugParts?.length === 2 ? `${slugParts[0]}/${slugParts[1]}` : "";
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  const { repo, commentCount, comments, isLoading, error, addComment, voteComment } =
    useRepoDetail(repoSlug);

  const [commentBody, setCommentBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [votingId, setVotingId] = useState<number | null>(null);

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

  const handleVote = async (commentId: number, value: 1 | -1) => {
    if (!isAuthenticated || votingId === commentId) return;
    setVotingId(commentId);
    try {
      await voteComment(commentId, value);
    } finally {
      setVotingId(null);
    }
  };

  if (!repoSlug) {
    return (
      <div className="mx-auto max-w-3xl p-4 md:p-6">
        <p className="text-muted-foreground">
          Invalid repository path. Use /explore/owner/repo
        </p>
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
        <div className="rounded-xl border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            {error ? "Failed to load repository." : "Repository not found."}
          </p>
        </div>
      </div>
    );
  }

  const langColor = repo.language
    ? (languageColors[repo.language] ?? "#8b8b8b")
    : null;
  const ownerAvatar = getAvatarImageAttrs(repo.owner_avatar, 40);

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      {/* Back link */}
      <Link
        href="/stars"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to stars
      </Link>

      {/* Repo header card */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          {/* Owner + name */}
          <div className="flex min-w-0 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ownerAvatar.src}
              srcSet={ownerAvatar.srcSet}
              sizes={ownerAvatar.sizes}
              alt={repo.owner_login}
              width={40}
              height={40}
              className="size-10 shrink-0 rounded-full"
              loading="eager"
              decoding="async"
              fetchPriority="high"
            />
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">
                {repo.owner_login}
              </p>
              <p className="truncate text-base font-semibold">{repo.name}</p>
            </div>
          </div>

          {/* GitHub CTA */}
          <a
            href={repo.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0"
          >
            <Button variant="outline" size="sm" className="gap-1.5">
              <ExternalLink className="size-3.5" />
              View on GitHub
            </Button>
          </a>
        </div>

        {/* Description */}
        {repo.description && (
          <p className="mt-4 leading-relaxed text-muted-foreground">
            {repo.description}
          </p>
        )}

        {/* Topics */}
        {repo.topics.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {repo.topics.map((topic) => (
              <Badge key={topic} variant="secondary" className="text-xs font-normal">
                {topic}
              </Badge>
            ))}
          </div>
        )}

        {/* Stats row */}
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Star className="size-3.5 fill-yellow-400 text-yellow-400" />
            <span className="font-medium text-foreground">
              {formatStarCount(repo.stargazers_count)}
            </span>
            <span>stars</span>
          </div>
          {repo.language && (
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 rounded-full"
                style={{ backgroundColor: langColor ?? undefined }}
              />
              <span>{repo.language}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <MessageSquare className="size-3.5" />
            <span>{commentCount} {commentCount === 1 ? "comment" : "comments"}</span>
          </div>
          {repo.repo_updated_at && (
            <div className="flex items-center gap-1.5">
              <GitFork className="size-3.5" />
              <span>Updated {timeAgo(repo.repo_updated_at)}</span>
            </div>
          )}
          {repo.repo_created_at && (
            <div className="flex items-center gap-1.5">
              <Calendar className="size-3.5" />
              <span>Created {formatDate(repo.repo_created_at)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Comments section */}
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Discussion
          {commentCount > 0 && (
            <span className="ml-2 font-normal text-muted-foreground">
              ({commentCount})
            </span>
          )}
        </h2>

        {/* Comment input at top */}
        <div className="mb-4">
          {isAuthenticated ? (
            <form onSubmit={handleSubmitComment} className="space-y-2">
              <textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Share your thoughts about this repo..."
                maxLength={2000}
                rows={3}
                className="w-full resize-none rounded-xl border bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {commentBody.length}/2000
                </span>
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
            <div className="rounded-xl border bg-card p-4 text-center text-sm text-muted-foreground">
              <Link href="/" className="font-medium text-foreground underline-offset-2 hover:underline">
                Sign in
              </Link>{" "}
              to join the discussion.
            </div>
          )}
        </div>

        {comments.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center">
            <MessageSquare className="mx-auto mb-2 size-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">No comments yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Be the first to share your thoughts!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => {
              const commentAvatar = comment.user.avatar_url
                ? getAvatarImageAttrs(comment.user.avatar_url, 28)
                : null;
              const isVoting = votingId === comment.id;
              return (
                <div
                  key={comment.id}
                  className="rounded-xl border bg-card p-4"
                >
                  <div className="flex items-center gap-2">
                    {comment.user.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={commentAvatar!.src}
                        srcSet={commentAvatar!.srcSet}
                        sizes={commentAvatar!.sizes}
                        alt={comment.user.username}
                        width={28}
                        height={28}
                        className="size-7 rounded-full"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
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
                  <p className="mt-2.5 text-sm leading-relaxed">
                    {comment.body}
                  </p>
                  {/* Vote buttons */}
                  <div className="mt-3 flex items-center gap-1 border-t pt-3">
                    <button
                      onClick={() => handleVote(comment.id, 1)}
                      disabled={!isAuthenticated || isVoting}
                      className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors disabled:cursor-default ${
                        comment.userVote === 1
                          ? "bg-green-500/10 text-green-600 dark:text-green-400"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                      }`}
                    >
                      <ThumbsUp className="size-3.5" />
                      <span>{comment.upvotes}</span>
                    </button>
                    <button
                      onClick={() => handleVote(comment.id, -1)}
                      disabled={!isAuthenticated || isVoting}
                      className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors disabled:cursor-default ${
                        comment.userVote === -1
                          ? "bg-red-500/10 text-red-600 dark:text-red-400"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                      }`}
                    >
                      <ThumbsDown className="size-3.5" />
                      <span>{comment.downvotes}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
