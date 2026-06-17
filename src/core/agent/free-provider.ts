import type { AgentConfig } from "../config/schema.js";
import { createProvider, type ResolvedAgent } from "../providers/registry.js";

/**
 * Build an OpenRouter provider on demand, keyed off `OPENROUTER_API_KEY` in the
 * environment. Used by the non-interactive `prd` and `review` commands (locally
 * and in CI) so they need no configured agent — just the secret.
 *
 * The model defaults to a free OpenRouter model; callers pass an explicit model
 * (CLI `--model` or a `POLYPUS_*_MODEL` env override) to change it.
 */
export function resolveFreeProvider(model: string): ResolvedAgent {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Export it (or add it as a repo secret in CI) before running this command.",
    );
  }
  const config: AgentConfig = {
    name: "openrouter-free",
    provider: "openrouter",
    model,
    apiKey: "${OPENROUTER_API_KEY}",
    toolMode: "native",
  };
  return createProvider(config);
}

/** Default free models per task; overridable via env then CLI `--model`. */
export const DEFAULT_PRD_MODEL = process.env.POLYPUS_PRD_MODEL ?? "openai/gpt-oss-120b:free";
export const DEFAULT_REVIEW_MODEL = process.env.POLYPUS_REVIEW_MODEL ?? "qwen/qwen3-coder:free";

/**
 * Retry a flaky call with exponential backoff. Free OpenRouter models are
 * heavily rate-limited (HTTP 429), so a couple of retries make the CLI/CI runs
 * far more reliable. Only transient errors (429, 5xx, network) are retried.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseMs?: number } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 4;
  const baseMs = opts.baseMs ?? 2000;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = (err as Error)?.message ?? "";
      const transient = /\b429\b|\b5\d\d\b|rate|timeout|ETIMEDOUT|ECONNRESET|EAI_AGAIN/i.test(msg);
      if (!transient || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, baseMs * 2 ** i));
    }
  }
  throw lastErr;
}
