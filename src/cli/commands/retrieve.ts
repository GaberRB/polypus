import { loadConfig } from "../../core/config/store.js";
import { createEmbedder } from "../../core/retrieval/embedder.js";
import { retrieve, formatChunks } from "../../core/retrieval/retriever.js";
import { t } from "../../core/i18n/index.js";

export interface RetrieveCliOptions {
  k?: string;
}

/** `polypus retrieve <query>` — print the top-K relevant chunks from the index. */
export async function retrieveCmd(query: string, opts: RetrieveCliOptions): Promise<void> {
  const config = await loadConfig();
  if (!config.embeddings) throw new Error(t("retrieval.notConfigured"));

  const embedder = createEmbedder(config.embeddings);
  const k = opts.k ? Number(opts.k) : config.retrieval.topK;
  const results = await retrieve(process.cwd(), embedder, query, k);
  if (results.length === 0) {
    console.log(t("retrieval.noResults"));
    return;
  }
  process.stdout.write(formatChunks(results) + "\n");
}
