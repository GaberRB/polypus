/** Discovery + filtering for OpenRouter's public model catalog. */

const MODELS_URL = "https://openrouter.ai/api/v1/models";

export interface OpenRouterModel {
  id: string;
  name: string;
  /** USD per 1M prompt tokens. */
  promptPrice: number;
  /** USD per 1M completion tokens. */
  completionPrice: number;
  contextLength: number;
  /** True when the model advertises native tool/function-calling. */
  supportsTools: boolean;
  /** True when both prompt and completion are free. */
  free: boolean;
  /** Popularity score of the model. */
  popularity: number;
}

interface RawModel {
  id?: string;
  name?: string;
  popularity?: number;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  supported_parameters?: string[];
}

/**
 * Fetch the OpenRouter model catalog. The endpoint is public; an API key is
 * optional. Throws on network/HTTP errors so callers can show a message.
 */
export async function listOpenRouterModels(
  apiKey?: string,
  timeoutMs = 8000,
): Promise<OpenRouterModel[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(MODELS_URL, {
      signal: controller.signal,
      headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {},
    });
    if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text().catch(() => "")}`);
    const data = (await res.json()) as { data?: RawModel[] };
    return (data.data ?? []).map(normalize).filter((m) => m.id.length > 0);
  } finally {
    clearTimeout(timer);
  }
}

function normalize(m: RawModel): OpenRouterModel {
  const promptPrice = toPerMillion(m.pricing?.prompt);
  const completionPrice = toPerMillion(m.pricing?.completion);
  return {
    id: m.id ?? "",
    name: m.name ?? m.id ?? "",
    promptPrice,
    completionPrice,
    contextLength: m.context_length ?? 0,
    supportsTools: (m.supported_parameters ?? []).includes("tools"),
    free: promptPrice === 0 && completionPrice === 0,
    popularity: m.popularity ?? 0, // Default to 0 if not provided
  };
}

/** OpenRouter prices are USD per token (string). Convert to USD per 1M tokens. */
function toPerMillion(price: string | undefined): number {
  const n = Number(price ?? "0");
  return Number.isFinite(n) ? n * 1_000_000 : 0;
}

export type ModelSort = "price" | "price-desc" | "context" | "name" | "popularity" | "popularity-desc";

export interface ModelFilter {
  search?: string;
  /** "any" | "tools" (only with tools) | "no-tools" (only without). */
  tools?: "any" | "tools" | "no-tools";
  freeOnly?: boolean;
  /** Max prompt price in USD per 1M tokens. */
  maxPrice?: number;
  /** Minimum popularity score. */
  minPopularity?: number;
  sort?: ModelSort;
}

/** Apply filters + sorting to a model list (pure; safe to call repeatedly). */
export function filterModels(models: OpenRouterModel[], f: ModelFilter): OpenRouterModel[] {
  const term = f.search?.trim().toLowerCase();
  let out = models.filter((m) => {
    if (term && !m.id.toLowerCase().includes(term) && !m.name.toLowerCase().includes(term)) {
      return false;
    }
    if (f.tools === "tools" && !m.supportsTools) return false;
    if (f.tools === "no-tools" && m.supportsTools) return false;
    if (f.freeOnly && !m.free) return false;
    // Negative price = variable/"auto" router pricing → excluded when capping price.
    if (f.maxPrice !== undefined && (m.promptPrice < 0 || m.promptPrice > f.maxPrice)) return false;
    if (f.minPopularity !== undefined && m.popularity < f.minPopularity) return false;
    return true;
  });

  // Variable-priced models sort to the end of price-based ordering.
  const key = (m: OpenRouterModel) => (m.promptPrice < 0 ? Number.POSITIVE_INFINITY : m.promptPrice);
  const sort = f.sort ?? "price";
  out = out.sort((a, b) => {
    switch (sort) {
      case "price-desc":
        return key(b) - key(a);
      case "context":
        return b.contextLength - a.contextLength;
      case "name":
        return a.id.localeCompare(b.id);
      case "popularity":
        return a.popularity - b.popularity;
      case "popularity-desc":
        return b.popularity - a.popularity;
      default:
        return key(a) - key(b);
    }
  });
  return out;
}

/** Format a price (USD per 1M tokens) compactly, e.g. "$3", "$0.15", "free". */
export function fmtPrice(perMillion: number): string {
  if (perMillion < 0) return "var";
  if (perMillion === 0) return "free";
  if (perMillion < 1) return `$${perMillion.toFixed(2)}`;
  if (perMillion < 100) return `$${perMillion.toFixed(perMillion % 1 ? 1 : 0)}`;
  return `$${Math.round(perMillion)}`;
}

/** Format a context length, e.g. "200k", "1M", "1.5M". */
export function fmtContext(n: number): string {
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}
