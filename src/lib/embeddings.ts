const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5";
const EMBEDDING_DIM = 768;
const BATCH_SIZE = 50;

interface EmbeddingResponse {
  data: { embedding: number[]; index: number }[];
}

interface AiBinding {
  run(model: string, input: { text: string[] }): Promise<{ data: number[][] }>;
}

export { EMBEDDING_DIM };

interface RepoAiMetadataInput {
  summary?: string | null;
  category?: string | null;
  subcategories?: string | string[] | null;
  use_cases?: string | string[] | null;
  keywords?: string | string[] | null;
}

/**
 * In Workers context (opennext), pull the direct AI binding.
 * Returns null when running in Node CLI (e.g. seed scripts) — caller falls
 * back to the HTTP gateway path.
 */
async function getAiBinding(): Promise<AiBinding | null> {
  try {
    const mod = await import("@opennextjs/cloudflare");
    const ctx = mod.getCloudflareContext();
    return (ctx.env as { AI?: AiBinding }).AI ?? null;
  } catch {
    return null;
  }
}

async function embedViaBinding(
  ai: AiBinding,
  texts: string[]
): Promise<number[][]> {
  const res = await ai.run(EMBEDDING_MODEL, { text: texts });
  return res.data;
}

async function embedViaHttp(texts: string[]): Promise<number[][]> {
  const url = process.env.AI_GATEWAY_URL;
  const key = process.env.AI_GATEWAY_API_KEY;
  if (!url || !key) {
    throw new Error(
      "No AI binding available and AI_GATEWAY_URL/AI_GATEWAY_API_KEY not set"
    );
  }
  const res = await fetch(`${url}/v1/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "x-gateway-project-id": "starboard",
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });
  if (!res.ok) {
    throw new Error(`Embedding API error ${res.status}: ${await res.text()}`);
  }
  const json: EmbeddingResponse = await res.json();
  const out: number[][] = new Array(texts.length);
  for (const item of json.data) out[item.index] = item.embedding;
  return out;
}

/** Build the text we embed for a repo — cheap, no extra API calls. */
export function buildRepoEmbeddingText(repo: {
  full_name: string;
  description: string | null;
  language: string | null;
  topics: string | string[];
  ai?: RepoAiMetadataInput | null;
}): string {
  const parts = [repo.full_name.replace("/", " ")];
  if (repo.description) parts.push(repo.description);
  if (repo.language) parts.push(repo.language);
  const topics =
    typeof repo.topics === "string" ? JSON.parse(repo.topics) : repo.topics;
  if (topics?.length) parts.push(topics.join(", "));
  if (repo.ai) {
    if (repo.ai.summary) parts.push(repo.ai.summary);
    if (repo.ai.category) parts.push(repo.ai.category);
    const subcategories = parseStringList(repo.ai.subcategories);
    if (subcategories.length) parts.push(subcategories.join(", "));
    const useCases = parseStringList(repo.ai.use_cases);
    if (useCases.length) parts.push(useCases.join(", "));
    const keywords = parseStringList(repo.ai.keywords);
    if (keywords.length) parts.push(keywords.join(", "));
  }
  return parts.join(" | ");
}

function parseStringList(value: string | string[] | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

/** Simple hash to detect when repo text changes. */
export function textHash(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

/**
 * Generate embeddings for one or more texts.
 * Prefers the direct CF Workers AI binding (when running inside a Worker via
 * opennext); falls back to the AI Gateway HTTP path otherwise (Node CLI scripts).
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const ai = await getAiBinding();
  const results: number[][] = new Array(texts.length);

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = ai
      ? await embedViaBinding(ai, batch)
      : await embedViaHttp(batch);
    for (let j = 0; j < embeddings.length; j++) {
      results[i + j] = embeddings[j];
    }
  }

  return results;
}

/** LRU cache for query embeddings — avoids re-embedding the same search query. */
const CACHE_MAX = 100;
const embeddingCache = new Map<string, number[]>();

/** Convenience: embed a single text (e.g. a search query). Cached. */
export async function generateEmbedding(text: string): Promise<number[]> {
  const key = text.trim().toLowerCase();
  const cached = embeddingCache.get(key);
  if (cached) return cached;

  const [embedding] = await generateEmbeddings([key]);

  // Evict oldest if at capacity
  if (embeddingCache.size >= CACHE_MAX) {
    const oldest = embeddingCache.keys().next().value!;
    embeddingCache.delete(oldest);
  }
  embeddingCache.set(key, embedding);

  return embedding;
}

/** Cosine similarity for two equal-length vectors. */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}
