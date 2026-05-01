/**
 * Reciprocal Rank Fusion. Merges multiple ranked id lists into one ordering.
 * Items appearing in multiple lists, especially near the top, score higher.
 *
 *   score(id) = sum over each list i: 1 / (k + rank_i(id))
 *
 * `k=60` is the canonical default from the original RRF paper.
 */
export function rrfFuse(lists: number[][], k = 60): number[] {
  const scores = new Map<number, number>();
  for (const list of lists) {
    for (let rank = 0; rank < list.length; rank++) {
      const id = list[rank];
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank));
    }
  }
  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
}

export function blendSearchIds(lexIds: number[], semIds: number[], k = 60): number[] {
  const fused = rrfFuse([lexIds, semIds], k);
  const out: number[] = [];
  const seen = new Set<number>();

  for (const id of lexIds.slice(0, 50)) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  for (const id of fused) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  for (const id of semIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }

  return out;
}

const SEARCH_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "app",
  "apps",
  "best",
  "for",
  "good",
  "in",
  "of",
  "on",
  "or",
  "platform",
  "platforms",
  "project",
  "projects",
  "repo",
  "repos",
  "repository",
  "repositories",
  "the",
  "thing",
  "things",
  "tool",
  "tools",
  "top",
  "with",
]);

const QUERY_EXPANSIONS: { triggers: RegExp[]; terms: string[] }[] = [
  {
    triggers: [/\blang\s*chain\b/i, /\blang-?chain\b/i, /\blan-?chain\b/i],
    terms: [
      "langchain",
      "langgraph",
      "llamaindex",
      "llama-index",
      "llama_index",
      "haystack",
      "crewai",
      "autogen",
      "semantic-kernel",
      "semantic",
      "kernel",
      "agno",
      "dify",
      "langflow",
    ],
  },
  {
    triggers: [/\breplacement/i, /\breplacements/i, /\balternative/i, /\balternatives/i],
    terms: ["alternative", "alternatives"],
  },
  {
    triggers: [/\beval\b/i, /\bevals\b/i, /\bevaluation\b/i, /\bbenchmark/i],
    terms: [
      "eval",
      "evals",
      "evaluation",
      "benchmark",
      "benchmarks",
      "promptfoo",
      "deepeval",
      "ragas",
      "langfuse",
      "langsmith",
      "langwatch",
      "phoenix",
      "helicone",
      "opik",
      "trulens",
      "giskard",
      "inspect_ai",
      "lm-evaluation-harness",
      "observability",
      "testing",
    ],
  },
];

function normalizeSearchTerm(term: string): string {
  return term.toLowerCase().replace(/^[-_]+|[-_]+$/g, "");
}

export function searchTerms(query: string, maxTerms = 24): string[] {
  const terms = new Set<string>();
  const normalized = query.toLowerCase();

  for (const raw of normalized.split(/[^a-z0-9+#._-]+/i)) {
    const term = normalizeSearchTerm(raw);
    if (term.length < 2 || SEARCH_STOP_WORDS.has(term)) continue;
    terms.add(term);

    const compact = term.replace(/[-_.]/g, "");
    if (compact !== term && compact.length >= 2) terms.add(compact);
  }

  for (const expansion of QUERY_EXPANSIONS) {
    if (!expansion.triggers.some((trigger) => trigger.test(query))) continue;
    for (const term of expansion.terms) terms.add(term);
  }

  return Array.from(terms).slice(0, maxTerms);
}

function ftsTerm(term: string): string | null {
  const cleaned = term.replace(/"/g, " ").trim();
  if (cleaned.length < 2) return null;
  if (/^[a-z0-9]+$/i.test(cleaned)) return `${cleaned}*`;
  return `"${cleaned}"`;
}

export function ftsSearchQuery(query: string): string | null {
  const terms = searchTerms(query)
    .map(ftsTerm)
    .filter((term): term is string => term !== null);
  if (terms.length === 0) return null;
  return terms.join(" OR ");
}

export function expandedSearchQuery(query: string): string {
  const terms = searchTerms(query);
  if (terms.length === 0) return query;
  return `${query} ${terms.join(" ")}`;
}
