import OpenAI from "openai";
import type { EmbeddingsConfig } from "../config/schema.js";
import { DEFAULT_BASE_URL } from "../providers/defaults.js";
import { resolveSecret } from "../config/store.js";
import { t } from "../i18n/index.js";

/** Turns text into vectors. Implemented over any OpenAI-compatible `/embeddings`. */
export interface Embedder {
  readonly model: string;
  /** Embed a batch of texts; returns one vector per input, in order. */
  embed(texts: string[]): Promise<number[][]>;
}

/**
 * Embedder backed by the OpenAI `/v1/embeddings` API. Both Ollama (`/v1`) and
 * generic OpenAI-compatible gateways implement it, so one client covers both.
 */
export class OpenAIEmbedder implements Embedder {
  readonly model: string;
  private readonly client: OpenAI;

  constructor(opts: { model: string; baseURL: string; apiKey?: string; timeoutMs?: number }) {
    this.model = opts.model;
    this.client = new OpenAI({
      baseURL: opts.baseURL,
      apiKey: opts.apiKey ?? "polypus-no-key",
      timeout: opts.timeoutMs ?? 120_000,
      maxRetries: 2,
    });
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const res = await this.client.embeddings.create({ model: this.model, input: texts });
    // The API guarantees response order matches input order via `index`.
    return [...res.data]
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding as number[]);
  }
}

/** Build the configured embedder, resolving the base URL and any secret reference. */
export function createEmbedder(cfg: EmbeddingsConfig): Embedder {
  const baseURL = cfg.baseUrl ?? DEFAULT_BASE_URL[cfg.provider];
  if (!baseURL) throw new Error(t("retrieval.noBaseUrl"));
  return new OpenAIEmbedder({
    model: cfg.model,
    baseURL,
    apiKey: resolveSecret(cfg.apiKey),
  });
}
