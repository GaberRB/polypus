import { z } from "zod";
import { loadConfig } from "../config/store.js";
import { createEmbedder } from "../retrieval/embedder.js";
import { retrieve, formatChunks } from "../retrieval/retriever.js";
import { t } from "../i18n/index.js";
import type { Tool } from "./types.js";

const Args = z.object({
  query: z.string().min(1),
  k: z.number().int().positive().max(50).optional(),
});

export const retrieveTool: Tool = {
  mutating: false,
  spec: {
    name: "retrieve",
    description:
      "Search the repository's semantic index for code/text relevant to a natural-language " +
      "query (RAG). Returns the most similar 'file:lines' chunks. Use it to locate concepts " +
      "by meaning (e.g. 'where do we validate permissions') rather than exact text. Requires " +
      "`polypus index` to have been run; if no index/embeddings are configured it returns a " +
      "note instead of an error.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural-language description of what to find" },
        k: { type: "number", description: "How many chunks to return (default from config)" },
      },
      required: ["query"],
    },
  },
  async run(rawArgs, ctx) {
    const parsed = Args.safeParse(rawArgs);
    if (!parsed.success) return { ok: false, output: "Invalid args: 'query' is required." };
    // Tools must never throw — surface every failure as a normal result.
    try {
      const config = await loadConfig();
      if (!config.embeddings) return { ok: true, output: t("retrieval.notConfigured") };
      const embedder = createEmbedder(config.embeddings);
      const k = parsed.data.k ?? config.retrieval.topK;
      const results = await retrieve(ctx.workspace, embedder, parsed.data.query, k);
      if (results.length === 0) return { ok: true, output: t("retrieval.noResults") };
      return { ok: true, output: formatChunks(results, config.retrieval.maxChars) };
    } catch (err) {
      return { ok: false, output: `retrieve failed: ${(err as Error).message}` };
    }
  },
};
