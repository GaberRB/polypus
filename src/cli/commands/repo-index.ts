import pc from "picocolors";
import { loadConfig, saveConfig } from "../../core/config/store.js";
import { EmbeddingsConfig } from "../../core/config/schema.js";
import { createEmbedder } from "../../core/retrieval/embedder.js";
import { buildIndex } from "../../core/retrieval/indexer.js";
import { loadIndex, saveIndex } from "../../core/retrieval/store.js";
import { t } from "../../core/i18n/index.js";

export interface IndexCliOptions {
  rebuild?: boolean;
  provider?: string;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
}

/** `polypus index` — build/update the repo's semantic index (incremental). */
export async function indexRepo(opts: IndexCliOptions): Promise<void> {
  const config = await loadConfig();
  const workspace = process.cwd();

  // Embeddings config: CLI flags (persisted to config) win, else what's stored.
  let embeddings = config.embeddings;
  if (opts.provider || opts.model || opts.baseUrl || opts.apiKey) {
    const parsed = EmbeddingsConfig.safeParse({
      provider: opts.provider ?? embeddings?.provider,
      model: opts.model ?? embeddings?.model,
      baseUrl: opts.baseUrl ?? embeddings?.baseUrl,
      apiKey: opts.apiKey ?? embeddings?.apiKey,
    });
    if (!parsed.success) throw new Error(t("retrieval.notConfigured"));
    embeddings = parsed.data;
    await saveConfig({ ...config, embeddings });
    console.error(pc.green(t("retrieval.configured", { provider: embeddings.provider, model: embeddings.model })));
  }
  if (!embeddings) throw new Error(t("retrieval.notConfigured"));

  const embedder = createEmbedder(embeddings);
  const prev = opts.rebuild ? null : await loadIndex(workspace);

  console.error(pc.dim(t("retrieval.indexing", { workspace })));
  const { data, stats } = await buildIndex(workspace, embedder, prev);
  await saveIndex(workspace, data);
  console.error(
    pc.green(
      t("retrieval.indexed", {
        embedded: stats.filesEmbedded,
        reused: stats.filesReused,
        skipped: stats.filesSkipped,
        chunks: stats.chunks,
      }),
    ),
  );
}
