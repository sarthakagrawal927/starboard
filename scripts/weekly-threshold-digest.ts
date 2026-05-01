/**
 * Generate the weekly GitHub issue body for repos crossing star thresholds.
 *
 * Required env:
 *   TURSO_DATABASE_URL
 *   TURSO_AUTH_TOKEN
 * Optional env:
 *   DIGEST_DAYS       — lookback window, default 7
 *   STAR_THRESHOLDS   — comma-separated thresholds, default 5000,10000,20000,50000,100000
 */

import { createClient } from "@libsql/client";

const DIGEST_DAYS = parseInt(process.env.DIGEST_DAYS || "7", 10);
const STAR_THRESHOLDS = (process.env.STAR_THRESHOLDS || "5000,10000,20000,50000,100000")
  .split(",")
  .map((value) => parseInt(value.trim(), 10))
  .filter((value) => Number.isFinite(value))
  .sort((a, b) => a - b);
const FASTEST_GROWERS_LIMIT = 20;
const MAX_REPOS_PER_THRESHOLD = 25;

interface ThresholdEvent {
  threshold: number;
  previous_stars: number | null;
  current_stars: number;
  crossed_at: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
}

interface FastestGrower {
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  current_stars: number;
  stars_gained: number;
}

interface TopRepo {
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  current_stars: number;
}

function formatStars(count: number): string {
  return count.toLocaleString("en-US");
}

function describeRepo(
  repo: Pick<ThresholdEvent, "description" | "language">
): string {
  const parts = [];
  if (repo.language) parts.push(repo.language);
  if (repo.description) parts.push(repo.description.replace(/\s+/g, " ").trim());
  return parts.length > 0 ? parts.join(" - ") : "No description";
}

function formatRepoLine(
  repo: Pick<
    ThresholdEvent,
    "current_stars" | "description" | "full_name" | "html_url" | "language"
  > & { previous_stars?: number | null; stars_gained?: number }
): string {
  const movement =
    repo.stars_gained !== undefined
      ? `+${formatStars(repo.stars_gained)} this week`
      : repo.previous_stars === null || repo.previous_stars === undefined
        ? "newly discovered above floor"
        : `${formatStars(repo.previous_stars)} -> ${formatStars(repo.current_stars)}`;

  return `- [${repo.full_name}](${repo.html_url}) - ${formatStars(repo.current_stars)} stars (${movement}) - ${describeRepo(repo)}`;
}

function formatTopRepoLine(repo: TopRepo): string {
  return `- [${repo.full_name}](${repo.html_url}) - ${formatStars(repo.current_stars)} stars - ${describeRepo(repo)}`;
}

function groupByThreshold(events: ThresholdEvent[]) {
  const groups = new Map<number, ThresholdEvent[]>();
  for (const threshold of STAR_THRESHOLDS) {
    groups.set(threshold, []);
  }
  for (const event of events) {
    const group = groups.get(event.threshold) ?? [];
    group.push(event);
    groups.set(event.threshold, group);
  }
  return groups;
}

async function main() {
  if (!process.env.TURSO_DATABASE_URL) {
    throw new Error("TURSO_DATABASE_URL required");
  }

  const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const lookback = `-${DIGEST_DAYS} days`;
  const corpusCounts = await Promise.all(
    STAR_THRESHOLDS.map(async (threshold) => {
      const result = await db.execute({
        sql: "SELECT COUNT(*) AS count FROM repos WHERE stargazers_count >= ?",
        args: [threshold],
      });
      return {
        threshold,
        count: result.rows[0]!.count as number,
      };
    })
  );

  const thresholdEventsResult = await db.execute({
    sql: `SELECT
            e.threshold,
            e.previous_stars,
            e.current_stars,
            e.crossed_at,
            r.full_name,
            r.html_url,
            r.description,
            r.language
          FROM repo_threshold_events e
          JOIN repos r ON r.id = e.repo_id
          WHERE e.crossed_at >= datetime('now', ?)
          ORDER BY e.threshold ASC, e.current_stars DESC`,
    args: [lookback],
  });

  const fastestGrowersResult = await db.execute({
    sql: `WITH recent AS (
            SELECT
              repo_id,
              MIN(captured_at) AS first_at,
              MAX(captured_at) AS last_at
            FROM repo_star_snapshots
            WHERE captured_at >= datetime('now', ?)
            GROUP BY repo_id
          ),
          first_rows AS (
            SELECT s.repo_id, s.stargazers_count
            FROM repo_star_snapshots s
            JOIN recent r
              ON r.repo_id = s.repo_id
             AND r.first_at = s.captured_at
          ),
          last_rows AS (
            SELECT s.repo_id, s.stargazers_count
            FROM repo_star_snapshots s
            JOIN recent r
              ON r.repo_id = s.repo_id
             AND r.last_at = s.captured_at
          )
          SELECT
            repos.full_name,
            repos.html_url,
            repos.description,
            repos.language,
            last_rows.stargazers_count AS current_stars,
            last_rows.stargazers_count - first_rows.stargazers_count AS stars_gained
          FROM recent
          JOIN first_rows ON first_rows.repo_id = recent.repo_id
          JOIN last_rows ON last_rows.repo_id = recent.repo_id
          JOIN repos ON repos.id = recent.repo_id
          WHERE last_rows.stargazers_count > first_rows.stargazers_count
          ORDER BY stars_gained DESC, current_stars DESC
          LIMIT ?`,
    args: [lookback, FASTEST_GROWERS_LIMIT],
  });

  const topReposResult = await db.execute({
    sql: `SELECT
            full_name,
            html_url,
            description,
            language,
            stargazers_count AS current_stars
          FROM repos
          ORDER BY stargazers_count DESC
          LIMIT 10`,
  });

  const thresholdEvents = thresholdEventsResult.rows as unknown as ThresholdEvent[];
  const fastestGrowers = fastestGrowersResult.rows as unknown as FastestGrower[];
  const topRepos = topReposResult.rows as unknown as TopRepo[];
  const groupedEvents = groupByThreshold(thresholdEvents);
  const totalCrossings = thresholdEvents.length;
  const generatedAt = new Date().toISOString().slice(0, 10);
  const lines = [
    `Weekly repo discovery digest for the last ${DIGEST_DAYS} days.`,
    "",
    `Generated: ${generatedAt} UTC`,
    `Threshold crossings: ${totalCrossings}`,
    "",
    "## Corpus snapshot",
    "",
    ...corpusCounts.map(
      (item) =>
        `- ${formatStars(item.threshold)}+ stars: ${formatStars(item.count)} repos`
    ),
    "",
    "### Top repos in corpus",
    "",
    ...topRepos.map((repo) => formatTopRepoLine(repo)),
    "",
    "## Threshold crossings",
    "",
  ];

  for (const [threshold, events] of groupedEvents) {
    lines.push(`### ${formatStars(threshold)} stars`);
    lines.push("");

    if (events.length === 0) {
      lines.push("No repos crossed this threshold.");
      lines.push("");
      continue;
    }

    for (const event of events.slice(0, MAX_REPOS_PER_THRESHOLD)) {
      lines.push(formatRepoLine(event));
    }
    if (events.length > MAX_REPOS_PER_THRESHOLD) {
      lines.push(`- ${events.length - MAX_REPOS_PER_THRESHOLD} more not shown`);
    }
    lines.push("");
  }

  lines.push("## Fastest growers");
  lines.push("");

  if (fastestGrowers.length === 0) {
    lines.push("No growth deltas yet. This section will populate after multiple seed snapshots exist in the lookback window.");
  } else {
    for (const repo of fastestGrowers) {
      lines.push(formatRepoLine(repo));
    }
  }

  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("- The 5,000-star section includes repos newly discovered above the seed floor.");
  lines.push("- Higher thresholds are recorded when a repo moves from below the threshold to above it between seed refreshes.");

  process.stdout.write(`${lines.join("\n")}\n`);
}

main().catch((err) => {
  console.error("Digest generation failed:", err);
  process.exit(1);
});
