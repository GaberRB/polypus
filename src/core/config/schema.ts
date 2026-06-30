import { z } from "zod";

/** Built-in provider kinds. Everything except `anthropic` is OpenAI-compatible. */
export const ProviderKind = z.enum([
  "openrouter",
  "ollama",
  "openai-compatible",
  "anthropic",
]);
export type ProviderKind = z.infer<typeof ProviderKind>;

// ---------------------------------------------------------------------------
// Custom Provider
// ---------------------------------------------------------------------------

export const CustomAuthType = z.enum(["none", "api-key", "oauth2-client-credentials"]);
export type CustomAuthType = z.infer<typeof CustomAuthType>;

export const CustomAuthConfig = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({
    type: z.literal("api-key"),
    /** Header to inject the key into (e.g. "Authorization"). */
    headerName: z.string().default("Authorization"),
    /** Key value or env reference like "${MY_API_KEY}". */
    apiKey: z.string().min(1),
  }),
  z.object({
    type: z.literal("oauth2-client-credentials"),
    tokenUrl: z.string().url(),
    clientId: z.string().min(1),
    /** Value or env reference like "${CLIENT_SECRET}". */
    clientSecret: z.string().min(1),
    /** OAuth2 grant type sent in the token request body. */
    grantType: z.string().default("client_credentials"),
    /** Extra headers to include in the token request. */
    tokenHeaders: z.record(z.string()).default({}),
    /** Extra body params to include in the token request (merged with grant_type/client_id/secret). */
    tokenParams: z.record(z.string()).default({}),
    /** JSONPath to extract token from auth response. */
    tokenPath: z.string().default("$.access_token"),
    /** JSONPath to extract expiry seconds from auth response. */
    expiresPath: z.string().optional(),
  }),
]);
export type CustomAuthConfig = z.infer<typeof CustomAuthConfig>;

/**
 * Generic API contract for a custom provider.
 * Body is a JSON string template; headers and URL may contain:
 *   {{prompt}}          — last user message
 *   {{auth.token}}      — resolved Bearer token (oauth2/api-key)
 *   {{params.<key>}}    — user-supplied param values
 */
export const CustomProviderConfig = z.object({
  name: z.string().min(1),
  auth: CustomAuthConfig,
  chat: z.object({
    /** May contain {{params.<key>}} placeholders. */
    url: z.string().min(1),
    method: z.string().default("POST"),
    /** Header values may contain {{auth.token}} / {{params.<key>}}. */
    headers: z.record(z.string()).default({}),
    /** JSON string template; must include {{prompt}}. */
    bodyTemplate: z.string().min(1),
  }),
  /** JSONPath to extract reply text from the chat response. */
  responsePath: z.string().min(1),
  /** JSONPath to extract a session/context ID from the response (optional). */
  sessionPath: z.string().optional(),
  /** Static values for {{params.<key>}} placeholders in URL / headers / body. */
  params: z.record(z.string()).default({}),
  /** Safety mode for this provider. */
  safetyMode: z.enum(["bypass", "read-only", "review"]).default("review"),
});
export type CustomProviderConfig = z.infer<typeof CustomProviderConfig>;

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

/**
 * Outbound-network rules for the web tools (web_search/web_fetch/download).
 * The https-only and SSRF/private-IP guards are always on (even in bypass) and
 * are NOT configurable here — these knobs only narrow or widen public access.
 */
export const NetworkPolicy = z.object({
  /** If non-empty, ONLY these domains (and their subdomains) are reachable. */
  allowDomains: z.array(z.string()).default([]),
  /** Domains (and subdomains) always blocked, even if otherwise allowed. */
  denyDomains: z.array(z.string()).default([]),
  /** Ports the agent may connect to. Defaults to https (443) only. */
  allowedPorts: z.array(z.number().int().positive()).default([443]),
});
export type NetworkPolicy = z.infer<typeof NetworkPolicy>;

export const Permissions = z.object({
  mode: PermissionMode.default("review"),
  /** Glob patterns of paths the agent may read/write, relative to the workspace root. */
  allow: z.array(z.string()).default(["**/*"]),
  /** Glob patterns that are always denied, even if they match `allow`. */
  deny: z.array(z.string()).default([".git/**", ".polypus/**", "**/.env"]),
  /** Shell commands (matched by prefix) the agent may run without per-call escalation. */
  allowedCommands: z.array(z.string()).default([]),
  /** Domain/port rules for the network tools. SSRF/https guards apply regardless. */
  network: NetworkPolicy.default({}),
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
  /**
   * When true, `polypus run` auto-injects the top matches for the task. On by
   * default: with embeddings configured it uses the semantic index; otherwise it
   * falls back to a cheap keyword search so weak/local models still get context
   * without any index setup.
   */
  auto: z.boolean().default(true),
  /** How many chunks to retrieve. */
  topK: z.number().int().positive().max(50).default(6),
  /** Cap on injected characters so retrieval never blows the context window. */
  maxChars: z.number().int().positive().default(8000),
});
export type RetrievalConfig = z.infer<typeof RetrievalConfig>;

/**
 * Execution profile: bundles the quality-vs-speed defaults behind one switch.
 * - `quality` (default): verification, plan-first and proactive context are ON —
 *   the engineering scaffolding that makes cheap/local models produce output on
 *   par with expensive tools.
 * - `fast`: that scaffolding is OFF for the cheapest, quickest runs.
 * Individual fields below always override whatever the profile implies.
 */
export const ExecutionProfile = z.enum(["quality", "fast"]);
export type ExecutionProfile = z.infer<typeof ExecutionProfile>;

export const ExecutionConfig = z.object({
  profile: ExecutionProfile.default("quality"),
  /**
   * Per-field overrides. Left `undefined`, each falls back to the profile's
   * preset; set explicitly (in config or via a CLI flag) it always wins.
   */
  /** Run project checks (typecheck/build/test/lint) before accepting `finish`. */
  verify: z.boolean().optional(),
  /** Force a short numbered plan before the agent starts acting. */
  planFirst: z.boolean().optional(),
  /** Proactively inject task-relevant context (semantic index or keyword fallback). */
  autoContext: z.boolean().optional(),
  /** How many times the agent may re-try to make verification checks pass. */
  maxVerifyFixes: z.number().int().min(0).max(10).default(3),
});
export type ExecutionConfig = z.infer<typeof ExecutionConfig>;

/** The concrete scaffolding each profile turns on. */
const PROFILE_PRESETS: Record<ExecutionProfile, { verify: boolean; planFirst: boolean; autoContext: boolean }> = {
  quality: { verify: true, planFirst: true, autoContext: true },
  fast: { verify: false, planFirst: false, autoContext: false },
};

/** Effective execution settings after resolution. */
export interface ResolvedExecution {
  profile: ExecutionProfile;
  verify: boolean;
  planFirst: boolean;
  autoContext: boolean;
  maxVerifyFixes: number;
}

/**
 * Resolve effective execution settings. Precedence per field:
 * CLI override → config field → profile preset. `overrides.profile` (e.g.
 * `--fast`/`--quality`) selects the preset; individual `overrides` (e.g.
 * `--no-verify`) win over everything.
 */
export function resolveExecution(
  cfg: ExecutionConfig,
  overrides: Partial<Pick<ResolvedExecution, "profile" | "verify" | "planFirst" | "autoContext">> = {},
): ResolvedExecution {
  const profile = overrides.profile ?? cfg.profile;
  const preset = PROFILE_PRESETS[profile];
  return {
    profile,
    verify: overrides.verify ?? cfg.verify ?? preset.verify,
    planFirst: overrides.planFirst ?? cfg.planFirst ?? preset.planFirst,
    autoContext: overrides.autoContext ?? cfg.autoContext ?? preset.autoContext,
    maxVerifyFixes: cfg.maxVerifyFixes,
  };
}

export const PolypusConfig = z.object({
  version: z.literal(1).default(1),
  /** Interface language. Defaults to pt-BR. */
  locale: Locale.default("pt-BR"),
  defaultAgent: z.string().optional(),
  agents: z.array(AgentConfig).default([]),
  customProviders: z.array(CustomProviderConfig).default([]),
  permissions: Permissions.default({}),
  /** Embeddings backend for the repository index (optional until `polypus index` is used). */
  embeddings: EmbeddingsConfig.optional(),
  retrieval: RetrievalConfig.default({}),
  /** Quality-vs-speed execution defaults (verification, plan-first, auto-context). */
  execution: ExecutionConfig.default({}),
});
export type PolypusConfig = z.infer<typeof PolypusConfig>;

export const DEFAULT_CONFIG: PolypusConfig = PolypusConfig.parse({});
