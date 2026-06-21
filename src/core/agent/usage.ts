import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentConfig } from "../config/schema.js";
import { configDir, resolveSecret } from "../config/store.js";
import { listOpenRouterModels, type OpenRouterModel } from "../providers/openrouter.js";
import type { Usage } from "./loop.js";

/** USD per 1M tokens, prompt and completion. */
export interface ModelPricing {
  promptPrice: number;
  completionPrice: number;
}

let catalogCache: Promise<OpenRouterModel[]> | undefined;

/**
 * Resolve per-token pricing for an agent's model. Currently only OpenRouter
 * advertises a public price catalog; other providers return undefined (cost is
 * simply not estimated). Network/parse failures degrade to undefined.
 */
export async function resolveModelPricing(agent: AgentConfig): Promise<ModelPricing | undefined> {
  if (agent.provider !== "openrouter") return undefined;
  try {
    catalogCache ??= listOpenRouterModels(resolveSecret(agent.apiKey));
    const models = await catalogCache;
    const m = models.find((x) => x.id === agent.model);
    if (!m || m.promptPrice < 0 || m.completionPrice < 0) return undefined;
    return { promptPrice: m.promptPrice, completionPrice: m.completionPrice };
  } catch {
    return undefined;
  }
}

/** Estimate the USD cost of a token usage given per-1M pricing. */
export function estimateCost(usage: Usage, pricing: ModelPricing): number {
  return (
    (usage.promptTokens / 1_000_000) * pricing.promptPrice +
    (usage.completionTokens / 1_000_000) * pricing.completionPrice
  );
}

/** Format a USD amount compactly, with extra precision for sub-cent costs. */
export function fmtUsd(n: number): string {
  if (n <= 0) return "US$0.00";
  if (n < 0.01) return `US$${n.toFixed(4)}`;
  return `US$${n.toFixed(2)}`;
}

export function usagePath(): string {
  return join(configDir(), "usage.jsonl");
}

export interface UsageEntry {
  ts: string;
  agent: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

/** Append a usage record to ~/.polypus/usage.jsonl (best-effort; never throws). */
export async function recordUsage(entry: UsageEntry): Promise<void> {
  try {
    await mkdir(configDir(), { recursive: true });
    await appendFile(usagePath(), JSON.stringify(entry) + "\n", "utf8");
  } catch {
    /* analytics are best-effort — ignore write failures */
  }
}

export interface UsageBucket {
  date: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  runs: number;
}

/** Aggregate the usage log by calendar day, plus a grand total. */
export async function aggregateUsage(): Promise<{ days: UsageBucket[]; total: UsageBucket }> {
  let text = "";
  try {
    text = await readFile(usagePath(), "utf8");
  } catch {
    return { days: [], total: emptyBucket("total") };
  }
  const byDay = new Map<string, UsageBucket>();
  const total = emptyBucket("total");
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let e: UsageEntry;
    try {
      e = JSON.parse(line) as UsageEntry;
    } catch {
      continue;
    }
    const date = (e.ts ?? "").slice(0, 10) || "unknown";
    const bucket = byDay.get(date) ?? emptyBucket(date);
    accumulate(bucket, e);
    byDay.set(date, bucket);
    accumulate(total, e);
  }
  const days = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { days, total };
}

function emptyBucket(date: string): UsageBucket {
  return { date, promptTokens: 0, completionTokens: 0, costUsd: 0, runs: 0 };
}

function accumulate(bucket: UsageBucket, e: UsageEntry): void {
  bucket.promptTokens += e.promptTokens ?? 0;
  bucket.completionTokens += e.completionTokens ?? 0;
  bucket.costUsd += e.costUsd ?? 0;
  bucket.runs += 1;
}
