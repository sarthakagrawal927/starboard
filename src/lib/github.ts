export interface StarredRepo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string; avatar_url: string };
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  topics: string[];
  updated_at: string;
  created_at: string;
}

export interface FetchResult {
  repos: StarredRepo[];
  etag: string | null;
  notModified: boolean;
}

/**
 * Fetch all starred repos from GitHub API, with optional ETag for conditional requests.
 * If etag is provided and data hasn't changed, returns { notModified: true }.
 */
export async function fetchAllStarredRepos(
  accessToken: string,
  cachedEtag?: string | null
): Promise<FetchResult> {
  const repos: StarredRepo[] = [];
  let page = 1;
  const perPage = 100;
  let firstPageEtag: string | null = null;

  while (true) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github.v3+json",
    };

    // Only send If-None-Match on the first page to check if anything changed
    if (page === 1 && cachedEtag) {
      headers["If-None-Match"] = cachedEtag;
    }

    const response = await fetch(
      `https://api.github.com/user/starred?per_page=${perPage}&page=${page}&sort=created&direction=desc`,
      { headers }
    );

    // 304 Not Modified — cache is still valid
    if (response.status === 304) {
      return { repos: [], etag: cachedEtag ?? null, notModified: true };
    }

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    // Capture ETag from first page
    if (page === 1) {
      firstPageEtag = response.headers.get("etag");
    }

    const data: StarredRepo[] = await response.json();
    repos.push(...data);

    if (data.length < perPage) break;
    page++;
  }

  return { repos, etag: firstPageEtag, notModified: false };
}
