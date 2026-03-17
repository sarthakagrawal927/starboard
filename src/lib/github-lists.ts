const GITHUB_ORIGIN = "https://github.com";

const HTML_HEADERS = {
  Accept: "text/html,application/xhtml+xml",
  "User-Agent": "starboard",
};

export interface GitHubStarList {
  name: string;
  slug: string;
  href: string;
  description: string | null;
  repoCount: number;
}

// GitHub's star Lists feature is public, but it does not have a documented API surface.
// Import list metadata and membership from the public stars pages as a best-effort fallback.
export async function fetchPublicStarLists(username: string): Promise<GitHubStarList[]> {
  const html = await fetchHtml(`${GITHUB_ORIGIN}/${encodeURIComponent(username)}?tab=stars`);
  return parsePublicStarLists(html, username);
}

export async function fetchPublicStarListRepoNames(listHref: string): Promise<string[]> {
  const repos = new Set<string>();
  let nextPageUrl: string | null = listHref;

  while (nextPageUrl) {
    const html = await fetchHtml(nextPageUrl);
    const page = parsePublicStarListRepoPage(html);

    for (const fullName of page.repoFullNames) {
      repos.add(fullName);
    }

    nextPageUrl = page.nextPageHref;
  }

  return [...repos];
}

export function parsePublicStarLists(html: string, username: string): GitHubStarList[] {
  const cards = html.matchAll(
    /<a\b(?=[^>]*class="[^"]*\bBox-row\b[^"]*")(?=[^>]*href="([^"]*\/stars\/[^"]+\/lists\/[^"]+)")[^>]*>([\s\S]*?)<\/a>/gi
  );
  const lists: GitHubStarList[] = [];
  const seenSlugs = new Set<string>();
  const usernamePath = `/stars/${username.toLowerCase()}/lists/`;

  for (const match of cards) {
    const href = decodeHtml(match[1] ?? "");
    const body = match[2] ?? "";
    const lowerHref = href.toLowerCase();

    if (!lowerHref.includes(usernamePath)) {
      continue;
    }

    const title = extractFirst(body, /<h3\b[^>]*>([\s\S]*?)<\/h3>/i);
    const rawDescription = extractFirst(
      body,
      /<span\b[^>]*class="[^"]*\bwb-break-word\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i
    );
    const rawCount = extractFirst(
      body,
      /<div\b[^>]*class="[^"]*\btext-small\b[^"]*"[^>]*>([\d,]+)\s+repositories<\/div>/i
    );

    const name = cleanText(title);
    const description = cleanText(rawDescription);
    const repoCount = parseInt((rawCount ?? "0").replace(/,/g, ""), 10) || 0;

    if (!name) {
      continue;
    }

    const absoluteHref = new URL(href, GITHUB_ORIGIN).toString();
    const slug = absoluteHref.split("/lists/")[1]?.split("?")[0]?.split("#")[0] ?? "";
    if (!slug || seenSlugs.has(slug)) {
      continue;
    }

    lists.push({
      name,
      slug,
      href: absoluteHref,
      description: description || null,
      repoCount,
    });
    seenSlugs.add(slug);
  }

  return lists;
}

export function parsePublicStarListRepoPage(html: string): {
  repoFullNames: string[];
  nextPageHref: string | null;
} {
  const repoMatches = html.matchAll(
    /<h2\b[^>]*class="h3"[^>]*>[\s\S]*?<a href="\/([^"/?#]+\/[^"/?#]+)"/gi
  );
  const repoFullNames: string[] = [];
  const seen = new Set<string>();

  for (const match of repoMatches) {
    const fullName = decodeHtml(match[1] ?? "");
    const normalized = fullName.toLowerCase();
    if (!fullName || seen.has(normalized)) {
      continue;
    }
    repoFullNames.push(fullName);
    seen.add(normalized);
  }

  const nextHref = extractFirst(html, /<a\b[^>]*rel="next"[^>]*href="([^"]+)"/i);

  return {
    repoFullNames,
    nextPageHref: nextHref ? new URL(decodeHtml(nextHref), GITHUB_ORIGIN).toString() : null,
  };
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, { headers: HTML_HEADERS });
  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub page: ${response.status} (${url})`);
  }
  return response.text();
}

function extractFirst(value: string, pattern: RegExp): string | null {
  const match = value.match(pattern);
  return match?.[1] ?? null;
}

function cleanText(value: string | null): string {
  if (!value) {
    return "";
  }

  return collapseWhitespace(stripTags(decodeHtml(value)));
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
