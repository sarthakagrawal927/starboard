"use client";

import { AlertTriangle, Archive, ArrowUpRight, GitBranch, Loader2, Radar, Star, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import useSWR from "swr";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RadarRepo,RadarReport } from "@/lib/release-radar";

const fetcher = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status}`);
  return response.json();
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { notation: "compact" }).format(value);
}

function formatAge(days: number | null): string {
  if (days === null) return "unknown";
  if (days < 1) return "today";
  if (days < 31) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

function laneIcon(lane: RadarRepo["primaryLane"]) {
  if (lane === "release") return <GitBranch className="size-4" />;
  if (lane === "momentum") return <Star className="size-4" />;
  return <Wrench className="size-4" />;
}

function laneLabel(lane: RadarRepo["primaryLane"]): string {
  if (lane === "release") return "Release";
  if (lane === "momentum") return "Momentum";
  return "Maintenance";
}

function toneClass(tone: RadarRepo["signals"][number]["tone"]): string {
  if (tone === "good") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (tone === "risk") return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
  return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
}

function RepoRadarCard({ repo }: { repo: RadarRepo }) {
  const topSignal = repo.signals[0];

  return (
    <Card className="gap-4 rounded-lg py-4 shadow-none">
      <CardHeader className="gap-3 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <Badge variant="outline" className="gap-1 text-xs">
                {laneIcon(repo.primaryLane)}
                {laneLabel(repo.primaryLane)}
              </Badge>
              {repo.archived && (
                <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
                  <Archive className="size-3" />
                  Archived
                </Badge>
              )}
            </div>
            <CardTitle className="mt-3 truncate text-base">
              <Link href={`/explore/${repo.fullName}`} className="hover:underline">
                {repo.fullName}
              </Link>
            </CardTitle>
          </div>
          <Button asChild variant="ghost" size="icon-sm" aria-label={`Open ${repo.fullName} on GitHub`}>
            <Link href={repo.htmlUrl} target="_blank" rel="noreferrer">
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-4">
        <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
          {repo.description ?? "No description available."}
        </p>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md border p-2">
            <div className="text-muted-foreground">Updated</div>
            <div className="mt-1 font-medium">{formatAge(repo.daysSinceUpdate)}</div>
          </div>
          <div className="rounded-md border p-2">
            <div className="text-muted-foreground">Stars</div>
            <div className="mt-1 font-medium">{formatNumber(repo.stargazersCount)}</div>
          </div>
          <div className="rounded-md border p-2">
            <div className="text-muted-foreground">30d</div>
            <div className="mt-1 font-medium">
              {repo.starDeltaThirtyDays === null ? "n/a" : `+${formatNumber(repo.starDeltaThirtyDays)}`}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {repo.signals.slice(0, 3).map((signal) => (
            <Badge key={`${repo.id}-${signal.label}`} variant="outline" className={toneClass(signal.tone)}>
              {signal.label}
            </Badge>
          ))}
        </div>
        {topSignal?.tone === "risk" && (
          <div className="flex items-start gap-2 rounded-md border border-red-500/20 bg-red-500/5 p-2 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-red-500" />
            <span>Review whether this repo still belongs in an active library or should move to an archive list.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function RadarPage() {
  const { status } = useSession();
  const router = useRouter();
  const { data, error, isLoading } = useSWR<RadarReport>("/api/radar", fetcher, {
    revalidateOnFocus: false,
  });

  if (status === "unauthenticated") {
    router.replace("/");
  }

  if (status === "loading" || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  const report = data ?? {
    repos: [],
    summary: { total: 0, releaseCount: 0, maintenanceCount: 0, momentumCount: 0 },
  };

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/80 px-4 py-3 backdrop-blur-sm md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md border">
              <Radar className="size-4" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Release Radar</h1>
              <p className="text-sm text-muted-foreground">Maintenance, momentum, and recent release signals from your library.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/discover">Discover</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/stars">Library</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-3 p-4 md:grid-cols-4 md:p-6">
        <Card className="rounded-lg py-4 shadow-none">
          <CardContent className="px-4">
            <div className="text-2xl font-semibold">{report.summary.total}</div>
            <div className="text-sm text-muted-foreground">tracked repos</div>
          </CardContent>
        </Card>
        <Card className="rounded-lg py-4 shadow-none">
          <CardContent className="px-4">
            <div className="text-2xl font-semibold">{report.summary.releaseCount}</div>
            <div className="text-sm text-muted-foreground">recent releases</div>
          </CardContent>
        </Card>
        <Card className="rounded-lg py-4 shadow-none">
          <CardContent className="px-4">
            <div className="text-2xl font-semibold">{report.summary.maintenanceCount}</div>
            <div className="text-sm text-muted-foreground">maintenance reviews</div>
          </CardContent>
        </Card>
        <Card className="rounded-lg py-4 shadow-none">
          <CardContent className="px-4">
            <div className="text-2xl font-semibold">{report.summary.momentumCount}</div>
            <div className="text-sm text-muted-foreground">momentum signals</div>
          </CardContent>
        </Card>
      </section>

      {error && (
        <div className="mx-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300 md:mx-6">
          Radar could not load.
        </div>
      )}

      <section className="grid gap-3 px-4 pb-8 md:grid-cols-2 md:px-6 xl:grid-cols-3">
        {report.repos.map((repo) => (
          <RepoRadarCard key={repo.id} repo={repo} />
        ))}
      </section>
    </main>
  );
}
