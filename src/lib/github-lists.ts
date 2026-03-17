const GITHUB_ORIGIN = "https://github.com";

const IGNORED_LIST_LABELS = new Set([
  "lists",
  "create list",
  "new list",
  "edit list",
  "view all",
  "show more",
  "show less",
]);

export interface GitHubStarList {
  name: string;
  href: string;
}

// GitHub's star Lists feature is public, but it does not have a documented API surface.
// Import list names from the public stars page as a best-effort fallback.
export async function fetchPublicStarLists(username: string): Promise<GitHubStarList[]> {
  const response = await fetch(`${GITHUB_ORIGIN}/${encodeURIComponent(username)}?tab=stars`, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "starboard",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub stars page: ${response.status}`);
  }

  const html = await response.text();
  return parsePublicStarLists(html, username);
}

export function parsePublicStarLists(html: string, username: string): GitHubStarList[] {
  const links = html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi);
  const seenNames = new Set<string>();
  const lists: GitHubStarList[] = [];

  for (const match of links) {
    const href = decodeHtml(match[1] ?? "");
    const text = collapseWhitespace(stripTags(decodeHtml(match[2] ?? "")));

    if (!text || !looksLikeStarListHref(href, username)) {
      continue;
    }

    const normalizedName = text.toLowerCase();
    if (IGNORED_LIST_LABELS.has(normalizedName) || seenNames.has(normalizedName)) {
      continue;
    }

    try {
      lists.push({
        name: text,
        href: new URL(href, GITHUB_ORIGIN).toString(),
      });
      seenNames.add(normalizedName);
    } catch {
      // Ignore malformed hrefs and keep import best-effort.
    }
  }

  return lists;
}

function looksLikeStarListHref(href: string, username: string): boolean {
  const decodedHref = decodeHtml(href);
  const lowerHref = decodedHref.toLowerCase();
  const lowerUsername = username.toLowerCase();

  return (
    lowerHref.includes(`/stars/${lowerUsername}/lists/`) ||
    (lowerHref.includes(`/${lowerUsername}?`) &&
      lowerHref.includes("tab=stars") &&
      lowerHref.includes("list"))
  );
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
