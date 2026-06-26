import type { EmbeddingsConfig, RetrievalConfig } from "../config/schema.js";
import { autoContext as semanticContext } from "../retrieval/retriever.js";
import { keywordContext } from "./keyword.js";

export interface ContextResult {
  block: string;
  count: number;
  /** Which strategy produced the context. */
  source: "semantic" | "keyword";
}

/**
 * Proactively gather task-relevant context for `polypus run`. Prefers the
 * semantic index when embeddings are configured; otherwise falls back to a
 * zero-setup keyword scan so weak/local models are grounded out of the box.
 * Never throws — returns null when disabled or nothing relevant is found.
 */
export async function gatherContext(
  workspace: string,
  query: string,
  opts: {
    enabled: boolean;
    embeddings?: EmbeddingsConfig;
    retrieval: RetrievalConfig;
  },
): Promise<ContextResult | null> {
  if (!opts.enabled) return null;

  // 1) Semantic retrieval, when an embeddings backend exists.
  if (opts.embeddings) {
    const semantic = await semanticContext(workspace, opts.embeddings, opts.retrieval, query);
    if (semantic) return { ...semantic, source: "semantic" };
  }

  // 2) Keyword fallback — no index or embeddings required.
  const keyword = await keywordContext(workspace, query, {
    topK: opts.retrieval.topK,
    maxChars: opts.retrieval.maxChars,
  });
  return keyword ? { ...keyword, source: "keyword" } : null;
}
