import pc from "picocolors";
import { aggregateUsage, fmtUsd, type UsageBucket } from "../../core/agent/usage.js";
import { t } from "../../core/i18n/index.js";

/** `polypus usage` — aggregate token/cost analytics per day from the usage log. */
export async function usage(): Promise<void> {
  const { days, total } = await aggregateUsage();
  if (days.length === 0) {
    console.log(pc.yellow(t("usage.empty")));
    return;
  }
  console.log(pc.bold(t("usage.header")));
  for (const d of days) console.log("  " + formatRow(d));
  console.log(pc.dim("  " + "─".repeat(40)));
  console.log("  " + pc.bold(formatRow({ ...total, date: t("usage.total") })));
}

function formatRow(b: UsageBucket): string {
  const tokens = fmtTokens(b.promptTokens + b.completionTokens);
  return `${b.date.padEnd(12)} ${tokens.padStart(7)} tok   ${fmtUsd(b.costUsd).padStart(10)}   (${b.runs} ${t("usage.runs")})`;
}

function fmtTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}
