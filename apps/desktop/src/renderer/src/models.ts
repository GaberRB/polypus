import type { OpenRouterModel } from "../../shared/ipc";

/**
 * Pure model filtering/formatting for the renderer (the Node-side lib can't be
 * imported here). Mirrors src/core/providers/openrouter.ts.
 */
export type ModelSort = "popularity-desc" | "price" | "price-desc" | "context" | "name";

export interface ModelFilter {
  search?: string;
  toolsOnly?: boolean;
  freeOnly?: boolean;
  maxPrice?: number;
  sort?: ModelSort;
}

export function filterModels(models: OpenRouterModel[], f: ModelFilter): OpenRouterModel[] {
  const term = f.search?.trim().toLowerCase();
  const out = models.filter((m) => {
    if (term && !m.id.toLowerCase().includes(term) && !m.name.toLowerCase().includes(term)) return false;
    if (f.toolsOnly && !m.supportsTools) return false;
    if (f.freeOnly && !m.free) return false;
    if (f.maxPrice !== undefined && (m.promptPrice < 0 || m.promptPrice > f.maxPrice)) return false;
    return true;
  });
  const priceKey = (m: OpenRouterModel) => (m.promptPrice < 0 ? Number.POSITIVE_INFINITY : m.promptPrice);
  const sort = f.sort ?? "popularity-desc";
  return out.sort((a, b) => {
    switch (sort) {
      case "price":
        return priceKey(a) - priceKey(b);
      case "price-desc":
        return priceKey(b) - priceKey(a);
      case "context":
        return b.contextLength - a.contextLength;
      case "name":
        return a.id.localeCompare(b.id);
      default:
        return b.popularity - a.popularity;
    }
  });
}

export function fmtPrice(perMillion: number): string {
  if (perMillion < 0) return "var";
  if (perMillion === 0) return "free";
  if (perMillion < 1) return `$${perMillion.toFixed(2)}`;
  if (perMillion < 100) return `$${perMillion.toFixed(perMillion % 1 ? 1 : 0)}`;
  return `$${Math.round(perMillion)}`;
}

export function fmtContext(n: number): string {
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}
