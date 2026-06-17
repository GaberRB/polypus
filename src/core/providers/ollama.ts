/** Discovery helpers for a local Ollama instance. */

function normalizeHost(host: string): string {
  let h = host.trim().replace(/\/v1\/?$/, "").replace(/\/$/, "");
  if (!/^https?:\/\//.test(h)) h = `http://${h}`;
  return h;
}

/** Default Ollama host, honoring the OLLAMA_HOST env var. */
export function ollamaHost(): string {
  return normalizeHost(process.env.OLLAMA_HOST ?? "http://localhost:11434");
}

/**
 * List models installed on a reachable Ollama instance (via /api/tags).
 * Returns [] when Ollama is not running or the request fails/times out.
 */
export async function listOllamaModels(
  host: string = ollamaHost(),
  timeoutMs = 2000,
): Promise<string[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${normalizeHost(host)}/api/tags`, { signal: controller.signal });
    if (!res.ok) return [];
    const data = (await res.json()) as { models?: Array<{ name?: string }> };
    return (data.models ?? [])
      .map((m) => m.name)
      .filter((n): n is string => Boolean(n));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
