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

export const PolypusConfig = z.object({
  version: z.literal(1).default(1),
  /** Interface language. Defaults to pt-BR. */
  locale: Locale.default("pt-BR"),
  defaultAgent: z.string().optional(),
  agents: z.array(AgentConfig).default([]),
  permissions: Permissions.default({}),
});
export type PolypusConfig = z.infer<typeof PolypusConfig>;

export const DEFAULT_CONFIG: PolypusConfig = PolypusConfig.parse({});
