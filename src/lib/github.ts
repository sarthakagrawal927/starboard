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

export async function fetchAllStarredRepos(accessToken: string): Promise<StarredRepo[]> {
  const repos: StarredRepo[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await fetch(
      `https://api.github.com/user/starred?per_page=${perPage}&page=${page}&sort=created&direction=desc`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data: StarredRepo[] = await response.json();
    repos.push(...data);

    if (data.length < perPage) break;
    page++;
  }

  return repos;
}
