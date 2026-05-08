import { describe, expect, it } from "vitest";

import { analyzeRadarRepo, buildRadarReport, type RadarRepoInput } from "@/lib/release-radar";

const baseRepo: RadarRepoInput = {
  id: 1,
  name: "repo",
  fullName: "owner/repo",
  ownerLogin: "owner",
  ownerAvatar: "https://example.com/avatar.png",
  htmlUrl: "https://github.com/owner/repo",
  description: "A useful library",
  language: "TypeScript",
  stargazersCount: 1000,
  archived: false,
  topics: ["typescript"],
  repoUpdatedAt: "2026-04-20T00:00:00Z",
  starredAt: "2026-01-01T00:00:00Z",
  starsThirtyDaysAgo: 900,
  thresholdEventsThirtyDays: 0,
};

describe("release radar", () => {
  const now = new Date("2026-05-08T00:00:00Z");

  it("flags recently updated repos as release candidates", () => {
    const repo = analyzeRadarRepo(baseRepo, now);

    expect(repo.primaryLane).toBe("release");
    expect(repo.signals.some((signal) => signal.label === "Updated this month")).toBe(true);
  });

  it("flags archived and stale repos as maintenance risks", () => {
    const repo = analyzeRadarRepo(
      {
        ...baseRepo,
        archived: true,
        repoUpdatedAt: "2024-01-01T00:00:00Z",
      },
      now
    );

    expect(repo.primaryLane).toBe("maintenance");
    expect(repo.signals[0]?.label).toBe("Archived");
    expect(repo.signals.some((signal) => signal.label === "No release in 12 months")).toBe(true);
  });

  it("adds momentum signals from star deltas", () => {
    const repo = analyzeRadarRepo(
      {
        ...baseRepo,
        repoUpdatedAt: "2026-02-01T00:00:00Z",
        stargazersCount: 1600,
        starsThirtyDaysAgo: 1000,
      },
      now
    );

    expect(repo.primaryLane).toBe("momentum");
    expect(repo.starDeltaThirtyDays).toBe(600);
  });

  it("summarizes radar lanes across repos", () => {
    const report = buildRadarReport(
      [
        baseRepo,
        { ...baseRepo, id: 2, fullName: "owner/stale", repoUpdatedAt: "2024-01-01T00:00:00Z" },
        { ...baseRepo, id: 3, fullName: "owner/hot", stargazersCount: 2000, starsThirtyDaysAgo: 1200 },
      ],
      now
    );

    expect(report.summary.total).toBe(3);
    expect(report.summary.releaseCount).toBe(2);
    expect(report.summary.maintenanceCount).toBe(1);
    expect(report.summary.momentumCount).toBe(3);
  });
});
