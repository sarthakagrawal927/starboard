const GATEWAY_URL = process.env.AI_GATEWAY_URL!;
const GATEWAY_KEY = process.env.AI_GATEWAY_API_KEY!;
const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5";
const EMBEDDING_DIM = 768;
const BATCH_SIZE = 50;

interface EmbeddingResponse {
  data: { embedding: number[]; index: number }[];
}

export { EMBEDDING_DIM };

/** Build the text we embed for a repo — cheap, no extra API calls. */
export function buildRepoEmbeddingText(repo: {
  full_name: string;
  description: string | null;
  language: string | null;
  topics: string | string[];
}): string {
  const parts = [repo.full_name.replace("/", " ")];
  if (repo.description) parts.push(repo.description);
  if (repo.language) parts.push(repo.language);
  const topics =
    typeof repo.topics === "string" ? JSON.parse(repo.topics) : repo.topics;
  if (topics?.length) parts.push(topics.join(", "));
  return parts.join(" | ");
}

/** Simple hash to detect when repo text changes. */
export function textHash(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

/** Generate embeddings for one or more texts via the AI gateway. */
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const results: number[][] = new Array(texts.length);

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const res = await fetch(`${GATEWAY_URL}/v1/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GATEWAY_KEY}`,
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: batch }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Embedding API error ${res.status}: ${body}`);
    }

    const json: EmbeddingResponse = await res.json();
    for (const item of json.data) {
      results[i + item.index] = item.embedding;
    }
  }

  return results;
}

/** Convenience: embed a single text (e.g. a search query). */
export async function generateEmbedding(text: string): Promise<number[]> {
  const [embedding] = await generateEmbeddings([text]);
  return embedding;
}
