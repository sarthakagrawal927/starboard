export type RadarLane = "release" | "maintenance" | "momentum";

export interface RadarRepoInput {
  id: number;
  name: string;
  fullName: string;
  ownerLogin: string;
  ownerAvatar: string;
  htmlUrl: string;
  description: string | null;
  language: string | null;
  stargazersCount: number;
  archived: boolean;
  topics: string[];
  repoUpdatedAt: string | null;
  starredAt: string | null;
  starsThirtyDaysAgo?: number | null;
  thresholdEventsThirtyDays?: number;
}

export interface RadarSignal {
  lane: RadarLane;
  label: string;
  tone: "good" | "watch" | "risk";
  score: number;
}

export interface RadarRepo extends RadarRepoInput {
  daysSinceUpdate: number | null;
  starDeltaThirtyDays: number | null;
  signals: RadarSignal[];
  primaryLane: RadarLane;
  score: number;
}

export interface RadarSummary {
  total: number;
  releaseCount: number;
  maintenanceCount: number;
  momentumCount: number;
}

export interface RadarReport {
  repos: RadarRepo[];
  summary: RadarSummary;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(now: Date, value: string | null): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY_MS));
}

function starDelta(repo: RadarRepoInput): number | null {
  if (typeof repo.starsThirtyDaysAgo !== "number") return null;
  return Math.max(0, repo.stargazersCount - repo.starsThirtyDaysAgo);
}

function pickPrimaryLane(signals: RadarSignal[]): RadarLane {
  const [topSignal] = [...signals].sort((a, b) => b.score - a.score);
  return topSignal?.lane ?? "maintenance";
}

export function analyzeRadarRepo(
  repo: RadarRepoInput,
  now = new Date()
): RadarRepo {
  const daysSinceUpdate = daysBetween(now, repo.repoUpdatedAt);
  const delta = starDelta(repo);
  const signals: RadarSignal[] = [];

  if (repo.archived) {
    signals.push({
      lane: "maintenance",
      label: "Archived",
      tone: "risk",
      score: 95,
    });
  }

  if (daysSinceUpdate !== null && daysSinceUpdate <= 30) {
    signals.push({
      lane: "release",
      label: "Updated this month",
      tone: "good",
      score: 80 - daysSinceUpdate,
    });
  } else if (daysSinceUpdate !== null && daysSinceUpdate >= 365) {
    signals.push({
      lane: "maintenance",
      label: "No release in 12 months",
      tone: "risk",
      score: 88,
    });
  } else if (daysSinceUpdate !== null && daysSinceUpdate >= 180) {
    signals.push({
      lane: "maintenance",
      label: "Quiet for 6 months",
      tone: "watch",
      score: 68,
    });
  }

  if (delta !== null && delta >= 500) {
    signals.push({
      lane: "momentum",
      label: `+${delta.toLocaleString()} stars in 30d`,
      tone: "good",
      score: 82,
    });
  } else if (delta !== null && delta >= 100) {
    signals.push({
      lane: "momentum",
      label: `+${delta.toLocaleString()} stars in 30d`,
      tone: "watch",
      score: 62,
    });
  }

  if ((repo.thresholdEventsThirtyDays ?? 0) > 0) {
    signals.push({
      lane: "momentum",
      label: `${repo.thresholdEventsThirtyDays} threshold crossed`,
      tone: "good",
      score: 58,
    });
  }

  if (!repo.description && repo.topics.length === 0) {
    signals.push({
      lane: "maintenance",
      label: "Missing summary metadata",
      tone: "watch",
      score: 42,
    });
  }

  if (signals.length === 0) {
    signals.push({
      lane: "maintenance",
      label: "Steady",
      tone: "watch",
      score: 20,
    });
  }

  const score = Math.max(...signals.map((signal) => signal.score));

  return {
    ...repo,
    daysSinceUpdate,
    starDeltaThirtyDays: delta,
    signals: signals.sort((a, b) => b.score - a.score),
    primaryLane: pickPrimaryLane(signals),
    score,
  };
}

export function buildRadarReport(
  repos: RadarRepoInput[],
  now = new Date()
): RadarReport {
  const analyzed = repos
    .map((repo) => analyzeRadarRepo(repo, now))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.stargazersCount - a.stargazersCount;
    });

  return {
    repos: analyzed,
    summary: {
      total: analyzed.length,
      releaseCount: analyzed.filter((repo) =>
        repo.signals.some((signal) => signal.lane === "release")
      ).length,
      maintenanceCount: analyzed.filter((repo) =>
        repo.signals.some((signal) => signal.lane === "maintenance" && signal.score >= 40)
      ).length,
      momentumCount: analyzed.filter((repo) =>
        repo.signals.some((signal) => signal.lane === "momentum")
      ).length,
    },
  };
}
