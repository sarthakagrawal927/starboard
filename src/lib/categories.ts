import { StarredRepo } from "./github";

export interface Category {
  name: string;
  slug: string;
  match: (repo: StarredRepo) => boolean;
}

const keywords = (terms: string[]) => (repo: StarredRepo) => {
  const text =
    `${repo.name} ${repo.description ?? ""} ${repo.topics.join(" ")}`.toLowerCase();
  return terms.some((t) => text.includes(t));
};

export const categories: Category[] = [
  {
    name: "AI / ML",
    slug: "ai-ml",
    match: keywords([
      "machine-learning",
      "deep-learning",
      "ai",
      "llm",
      "gpt",
      "neural",
      "ml",
      "nlp",
      "transformer",
      "diffusion",
    ]),
  },
  {
    name: "DevOps",
    slug: "devops",
    match: keywords([
      "devops",
      "ci-cd",
      "docker",
      "kubernetes",
      "k8s",
      "terraform",
      "ansible",
      "helm",
      "monitoring",
      "observability",
    ]),
  },
  {
    name: "Frontend",
    slug: "frontend",
    match: keywords([
      "react",
      "vue",
      "svelte",
      "angular",
      "frontend",
      "css",
      "ui-component",
      "tailwind",
      "nextjs",
    ]),
  },
  {
    name: "Backend",
    slug: "backend",
    match: keywords([
      "api",
      "backend",
      "server",
      "rest",
      "graphql",
      "microservice",
      "database",
      "orm",
    ]),
  },
  {
    name: "CLI Tools",
    slug: "cli-tools",
    match: keywords([
      "cli",
      "terminal",
      "command-line",
      "shell",
      "bash",
      "zsh",
    ]),
  },
  {
    name: "Security",
    slug: "security",
    match: keywords([
      "security",
      "authentication",
      "encryption",
      "vulnerability",
      "pentest",
      "owasp",
    ]),
  },
  {
    name: "Data",
    slug: "data",
    match: keywords([
      "data",
      "analytics",
      "visualization",
      "pandas",
      "sql",
      "etl",
      "pipeline",
      "streaming",
    ]),
  },
  {
    name: "Learning",
    slug: "learning",
    match: keywords([
      "tutorial",
      "learn",
      "course",
      "awesome",
      "guide",
      "cheatsheet",
      "interview",
      "algorithm",
    ]),
  },
  {
    name: "Self-Hosted",
    slug: "self-hosted",
    match: keywords([
      "self-hosted",
      "selfhosted",
      "homelab",
      "home-server",
      "docker-compose",
    ]),
  },
];

export function categorizeRepos(
  repos: StarredRepo[]
): Record<string, StarredRepo[]> {
  const result: Record<string, StarredRepo[]> = {};
  for (const cat of categories) {
    result[cat.slug] = repos.filter(cat.match);
  }
  result["uncategorized"] = repos.filter(
    (r) => !categories.some((c) => c.match(r))
  );
  return result;
}
