import pc from "picocolors";
import {
  aggregateUsage,
  aggregateUsageByModel,
  fmtUsd,
  projectUsagePath,
  usagePath,
  type UsageBucket,
  type UsageModelBucket,
} from "../../core/agent/usage.js";
import { t } from "../../core/i18n/index.js";

export interface UsageCliOptions {
  /** Aggregate the global log (~/.polypus/usage.jsonl) instead of this project's. */
  global?: boolean;
}

/** `polypus usage` — token/cost analytics by model (efficiency) and per day. */
export async function usage(opts: UsageCliOptions = {}): Promise<void> {
  const path = opts.global ? usagePath() : projectUsagePath(process.cwd());

  const [{ models, total }, { days }] = await Promise.all([
    aggregateUsageByModel(path),
    aggregateUsage(path),
  ]);

  if (models.length === 0) {
    console.log(pc.yellow(t("usage.empty")));
    if (!opts.global) console.log(pc.dim(t("usage.tryGlobal")));
    return;
  }

  console.log(pc.dim(opts.global ? t("usage.scopeGlobal") : t("usage.scopeProject")) + "\n");

  // --- Efficiency per model: table + comparison bars ---------------------------
  console.log(pc.bold(t("usage.byModel")));
  console.log(pc.dim("  " + modelHeader()));
  for (const m of models) console.log("  " + formatModelRow(m));
  console.log(pc.dim("  " + "─".repeat(64)));
  console.log("  " + pc.bold(formatModelRow({ ...total, model: t("usage.total"), provider: "" })));

  // Bars are sized by cost share; if everything is free (cost 0), fall back to
  // token share so free models are still comparable.
  const useCost = total.costUsd > 0;
  const denom = useCost
    ? total.costUsd
    : Math.max(1, total.promptTokens + total.completionTokens);
  console.log("");
  for (const m of models) {
    const value = useCost ? m.costUsd : m.promptTokens + m.completionTokens;
    console.log("  " + bar(m.model, value / denom));
  }

  // --- Existing per-day view ---------------------------------------------------
  console.log("\n" + pc.bold(t("usage.header")));
  for (const d of days) console.log("  " + formatDayRow(d));
  console.log(pc.dim("  " + "─".repeat(40)));
  console.log("  " + pc.bold(formatDayRow({ ...total, date: t("usage.total") })));
}

const MODEL_W = 28;

function modelHeader(): string {
  return (
    t("usage.colModel").padEnd(MODEL_W) +
    t("usage.colRuns").padStart(6) +
    t("usage.colTokens").padStart(9) +
    t("usage.colCost").padStart(11) +
    t("usage.colPerRun").padStart(11) +
    "  " +
    t("usage.colPer1k").padStart(10)
  );
}

function formatModelRow(m: UsageModelBucket): string {
  const tokens = m.promptTokens + m.completionTokens;
  const perRun = m.runs > 0 ? fmtUsd(m.costUsd / m.runs) : "—";
  const per1k = tokens > 0 && m.costUsd > 0 ? fmtUsd(m.costUsd / (tokens / 1000)) : "—";
  return (
    truncate(m.model, MODEL_W).padEnd(MODEL_W) +
    String(m.runs).padStart(6) +
    fmtTokens(tokens).padStart(9) +
    fmtUsd(m.costUsd).padStart(11) +
    perRun.padStart(11) +
    "  " +
    per1k.padStart(10)
  );
}

function formatDayRow(b: UsageBucket): string {
  const tokens = fmtTokens(b.promptTokens + b.completionTokens);
  return `${b.date.padEnd(12)} ${tokens.padStart(7)} tok   ${fmtUsd(b.costUsd).padStart(10)}   (${b.runs} ${t("usage.runs")})`;
}

/** A labelled horizontal bar; `share` is 0..1 of the largest dimension. */
function bar(label: string, share: number): string {
  const width = 24;
  const filled = Math.max(share > 0 ? 1 : 0, Math.round(share * width));
  const pct = `${(share * 100).toFixed(0)}%`;
  return `${truncate(label, MODEL_W).padEnd(MODEL_W)} ${pc.cyan("█".repeat(filled))}${pc.dim("░".repeat(width - filled))} ${pct.padStart(4)}`;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function fmtTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}
