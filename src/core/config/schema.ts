import { z } from "zod";

/** Built-in provider kinds. Everything except `anthropic` is OpenAI-compatible. */
export const ProviderKind = z.enum([
  "openrouter",
  "ollama",
  "openai-compatible",
  "anthropic",
]);
export type ProviderKind = z.infer<typeof ProviderKind>;

/**
 * How the harness should drive tool-calling for an agent.
 * - `auto`: probe the provider/model and decide (native if available, else emulated).
 * - `native`: use the provider's function-calling API.
 * - `emulated`: inject the XML tool protocol into the prompt and parse the text output.
 */
export const ToolMode = z.enum(["auto", "native", "emulated"]);
export type ToolMode = z.infer<typeof ToolMode>;

export const PermissionMode = z.enum(["plan", "review", "bypass"]);
export type PermissionMode = z.infer<typeof PermissionMode>;

export const AgentConfig = z.object({
  /** Unique, human-friendly identifier used by add-agent/remove-agent and orchestration. */
  name: z.string().min(1),
  provider: ProviderKind,
  /** Override the provider's default base URL (required for `openai-compatible`). */
  baseUrl: z.string().url().optional(),
  model: z.string().min(1),
  /**
   * API key. Prefer an env reference like "${OPENROUTER_API_KEY}" over an inline secret.
   * Optional because local providers (Ollama) do not need one.
   */
  apiKey: z.string().optional(),
  toolMode: ToolMode.default("auto"),
});
export type AgentConfig = z.infer<typeof AgentConfig>;

export const Permissions = z.object({
  mode: PermissionMode.default("review"),
  /** Glob patterns of paths the agent may read/write, relative to the workspace root. */
  allow: z.array(z.string()).default(["**/*"]),
  /** Glob patterns that are always denied, even if they match `allow`. */
  deny: z.array(z.string()).default([".git/**", ".polypus/**", "**/.env"]),
  /** Shell commands (matched by prefix) the agent may run without per-call escalation. */
  allowedCommands: z.array(z.string()).default([]),
});
export type Permissions = z.infer<typeof Permissions>;

export const Locale = z.enum(["pt-BR", "en"]);
export type Locale = z.infer<typeof Locale>;

/**
 * Embeddings backend used by the repository index (`polypus index` / retrieval).
 * Only `ollama` and `openai-compatible` expose an embeddings endpoint — OpenRouter
 * does not, so it is intentionally excluded here.
 */
export const EmbeddingsConfig = z.object({
  provider: z.enum(["ollama", "openai-compatible"]),
  /** Required for `openai-compatible`; defaults to the local Ollama URL otherwise. */
  baseUrl: z.string().url().optional(),
  /** Embedding model, e.g. "nomic-embed-text" (Ollama) or "text-embedding-3-small". */
  model: z.string().min(1),
  /** Prefer an env reference like "${OPENAI_API_KEY}". Ollama needs none. */
  apiKey: z.string().optional(),
});
export type EmbeddingsConfig = z.infer<typeof EmbeddingsConfig>;

/** Semantic-retrieval (RAG) settings for context selection. */
export const RetrievalConfig = z.object({
  /** When true, `polypus run` auto-injects the top matches for the task. Off by default. */
  auto: z.boolean().default(false),
  /** How many chunks to retrieve. */
  topK: z.number().int().positive().max(50).default(6),
  /** Cap on injected characters so retrieval never blows the context window. */
  maxChars: z.number().int().positive().default(8000),
});
export type RetrievalConfig = z.infer<typeof RetrievalConfig>;

export const PolypusConfig = z.object({
  version: z.literal(1).default(1),
  /** Interface language. Defaults to pt-BR. */
  locale: Locale.default("pt-BR"),
  defaultAgent: z.string().optional(),
  agents: z.array(AgentConfig).default([]),
  permissions: Permissions.default({}),
  /** Embeddings backend for the repository index (optional until `polypus index` is used). */
  embeddings: EmbeddingsConfig.optional(),
  retrieval: RetrievalConfig.default({}),
});
export type PolypusConfig = z.infer<typeof PolypusConfig>;

export const DEFAULT_CONFIG: PolypusConfig = PolypusConfig.parse({});
