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

/** Anthropic cache billing multipliers vs the base input price. Cache reads are
 * ~10% of input; writes carry a ~25% premium. Used as an approximation for other
 * providers' automatic caching too (their real discount varies). */
const CACHE_READ_MULT = 0.1;
const CACHE_WRITE_MULT = 1.25;

/**
 * Estimate the USD cost of a token usage given per-1M pricing. `promptTokens` is
 * the total input (incl. cached); the cached read/write portions are re-priced at
 * the cache multipliers, and the remainder at the full input price.
 */
export function estimateCost(usage: Usage, pricing: ModelPricing): number {
  const cacheRead = usage.cacheReadTokens ?? 0;
  const cacheWrite = usage.cacheCreationTokens ?? 0;
  const fullRate = Math.max(0, usage.promptTokens - cacheRead - cacheWrite);
  const inputCost =
    (fullRate / 1_000_000) * pricing.promptPrice +
    (cacheWrite / 1_000_000) * pricing.promptPrice * CACHE_WRITE_MULT +
    (cacheRead / 1_000_000) * pricing.promptPrice * CACHE_READ_MULT;
  return inputCost + (usage.completionTokens / 1_000_000) * pricing.completionPrice;
}

/** Format a USD amount compactly, with extra precision for sub-cent costs. */
export function fmtUsd(n: number): string {
  if (n <= 0) return "US$0.00";
  if (n < 0.01) return `US$${n.toFixed(4)}`;
  return `US$${n.toFixed(2)}`;
}

/** Global usage log, shared across all projects. */
export function usagePath(): string {
  return join(configDir(), "usage.jsonl");
}

/** Per-project usage log, kept inside the workspace's .poly folder. */
export function projectUsagePath(workspace: string): string {
  return join(workspace, ".poly", "usage.jsonl");
}

export interface UsageEntry {
  ts: string;
  agent: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  /** Input tokens served from cache this run (optional; absent on old logs). */
  cacheReadTokens?: number;
  /** Input tokens written to cache this run (optional; absent on old logs). */
  cacheCreationTokens?: number;
}

async function appendEntry(dir: string, file: string, line: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  await appendFile(file, line, "utf8");
}

/**
 * Append a usage record to the global log (~/.polypus/usage.jsonl) and, when a
 * workspace is given, also to that project's .poly/usage.jsonl. Best-effort:
 * each target is written independently and write failures are swallowed so
 * analytics never disrupt a run.
 */
export async function recordUsage(entry: UsageEntry, opts: { workspace?: string } = {}): Promise<void> {
  const line = JSON.stringify(entry) + "\n";
  await appendEntry(configDir(), usagePath(), line).catch(() => {
    /* analytics are best-effort — ignore write failures */
  });
  if (opts.workspace) {
    await appendEntry(join(opts.workspace, ".poly"), projectUsagePath(opts.workspace), line).catch(() => {
      /* best-effort per-project log */
    });
  }
}

/** Read and parse the NDJSON usage log at `path`; missing/malformed lines are skipped. */
export async function readUsageEntries(path: string): Promise<UsageEntry[]> {
  let text = "";
  try {
    text = await readFile(path, "utf8");
  } catch {
    return [];
  }
  const entries: UsageEntry[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line) as UsageEntry);
    } catch {
      /* skip malformed line */
    }
  }
  return entries;
}

export interface UsageBucket {
  date: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  runs: number;
}

/** Aggregate a usage log by calendar day, plus a grand total. */
export async function aggregateUsage(
  path: string = usagePath(),
): Promise<{ days: UsageBucket[]; total: UsageBucket }> {
  const entries = await readUsageEntries(path);
  const byDay = new Map<string, UsageBucket>();
  const total = emptyBucket("total");
  for (const e of entries) {
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

function accumulate(bucket: { promptTokens: number; completionTokens: number; costUsd: number; runs: number }, e: UsageEntry): void {
  bucket.promptTokens += e.promptTokens ?? 0;
  bucket.completionTokens += e.completionTokens ?? 0;
  bucket.costUsd += e.costUsd ?? 0;
  bucket.runs += 1;
}

export interface UsageModelBucket {
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  runs: number;
}

/**
 * Aggregate a usage log by model (to compare per-model efficiency), plus a grand
 * total. Models are ordered by cost desc, then total tokens desc so free models
 * still rank by volume.
 */
export async function aggregateUsageByModel(
  path: string = usagePath(),
): Promise<{ models: UsageModelBucket[]; total: UsageModelBucket }> {
  const entries = await readUsageEntries(path);
  const byModel = new Map<string, UsageModelBucket>();
  const total = emptyModelBucket("total", "");
  for (const e of entries) {
    const model = e.model || "unknown";
    const bucket = byModel.get(model) ?? emptyModelBucket(model, e.provider ?? "");
    accumulate(bucket, e);
    byModel.set(model, bucket);
    accumulate(total, e);
  }
  const models = [...byModel.values()].sort(
    (a, b) =>
      b.costUsd - a.costUsd ||
      b.promptTokens + b.completionTokens - (a.promptTokens + a.completionTokens),
  );
  return { models, total };
}

function emptyModelBucket(model: string, provider: string): UsageModelBucket {
  return { model, provider, promptTokens: 0, completionTokens: 0, costUsd: 0, runs: 0 };
}
