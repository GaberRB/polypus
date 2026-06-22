import { t } from "../i18n/index.js";
import type { EmbeddingsConfig, RetrievalConfig } from "../config/schema.js";
import { createEmbedder, type Embedder } from "./embedder.js";
import { loadIndex, type StoredChunk } from "./store.js";

export interface ScoredChunk {
  chunk: StoredChunk;
  /** Cosine similarity in [-1, 1]; higher is more relevant. */
  score: number;
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i]! * b[i]!;
  return s;
}

function norm(a: number[]): number {
  return Math.sqrt(dot(a, a));
}

/** Rank chunks by cosine similarity to a query vector. Pure (unit-testable). */
export function cosineTopK(query: number[], chunks: StoredChunk[], k: number): ScoredChunk[] {
  const qn = norm(query);
  if (qn === 0) return [];
  return chunks
    .map((chunk) => ({ chunk, score: dot(query, chunk.vector) / (qn * (norm(chunk.vector) || 1)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, k));
}

/** Embed a query and return the top-K most similar chunks from the repo index. */
export async function retrieve(
  workspace: string,
  embedder: Embedder,
  query: string,
  k: number,
): Promise<ScoredChunk[]> {
  const index = await loadIndex(workspace);
  if (!index || index.chunks.length === 0) throw new Error(t("retrieval.noIndex"));
  const [queryVec] = await embedder.embed([query]);
  if (!queryVec) return [];
  return cosineTopK(queryVec, index.chunks, k);
}

/**
 * Best-effort auto-context for `polypus run`: when retrieval is enabled and an
 * index exists, return a formatted block of the top matches for the task. Never
 * throws — any failure (no index, embeddings server down) yields null so the run
 * proceeds without retrieval.
 */
export async function autoContext(
  workspace: string,
  embeddings: EmbeddingsConfig | undefined,
  retrieval: RetrievalConfig,
  query: string,
): Promise<{ block: string; count: number } | null> {
  if (!retrieval.auto || !embeddings) return null;
  try {
    const embedder = createEmbedder(embeddings);
    const results = await retrieve(workspace, embedder, query, retrieval.topK);
    if (results.length === 0) return null;
    return { block: formatChunks(results, retrieval.maxChars), count: results.length };
  } catch {
    return null;
  }
}

/** Render scored chunks as a Markdown block: one `## file:lines` section each. */
export function formatChunks(results: ScoredChunk[], maxChars = Infinity): string {
  const blocks: string[] = [];
  let used = 0;
  for (const { chunk, score } of results) {
    const header = `## ${chunk.file}:${chunk.startLine}-${chunk.endLine} (${score.toFixed(3)})`;
    const block = `${header}\n\`\`\`\n${chunk.text}\n\`\`\``;
    if (used + block.length > maxChars && blocks.length > 0) break;
    blocks.push(block);
    used += block.length + 2;
  }
  return blocks.join("\n\n");
}
