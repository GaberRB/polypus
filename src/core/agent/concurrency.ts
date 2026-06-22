import type { ResolvedAgent } from "../providers/registry.js";

/**
 * How many workers may hit a single Ollama endpoint at once. Local Ollama serves
 * one or two models at a time and thrashes under more, so we cap it low to avoid
 * the contention that froze a 5-agent swarm. Tune here.
 */
export const OLLAMA_ENDPOINT_CONCURRENCY = 2;

/** Default idle timeout (ms) before a worker that stops making progress is aborted. */
export const DEFAULT_IDLE_TIMEOUT_MS = 300_000;

function endpointKey(agent: ResolvedAgent): string {
  return `${agent.config.provider}:${agent.config.baseUrl ?? "default"}`;
}

/**
 * Recommend how many workers to run concurrently for a set of agents. Hosted
 * providers parallelize freely (capacity = agents on that endpoint), while each
 * Ollama endpoint is capped at {@link OLLAMA_ENDPOINT_CONCURRENCY}. Capacities
 * sum across distinct endpoints. Always at least 1.
 */
export function recommendConcurrency(agents: ResolvedAgent[]): number {
  const perEndpoint = new Map<string, number>();
  for (const a of agents) {
    perEndpoint.set(endpointKey(a), (perEndpoint.get(endpointKey(a)) ?? 0) + 1);
  }
  let total = 0;
  for (const [key, count] of perEndpoint) {
    total += key.startsWith("ollama:") ? Math.min(count, OLLAMA_ENDPOINT_CONCURRENCY) : count;
  }
  return Math.max(1, total);
}

/** Idle timeout from env (`POLYPUS_SWARM_IDLE_TIMEOUT_MS`) or the default. */
export function idleTimeoutMs(): number {
  const raw = Number(process.env.POLYPUS_SWARM_IDLE_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_IDLE_TIMEOUT_MS;
}

/** Overall timeout (ms) for the entire swarm session from env (`POLYPUS_SWARM_OVERALL_TIMEOUT_MS`) or the default. */
export function overallTimeoutMs(): number {
  const raw = Number(process.env.POLYPUS_SWARM_OVERALL_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 3_600_000; // Default: 1 hour
}
