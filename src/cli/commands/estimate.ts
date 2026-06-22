import pc from "picocolors";
import { loadConfig, resolveAgent } from "../../core/config/store.js";
import { createProvider } from "../../core/providers/registry.js";
import { estimateTask } from "../../core/agent/estimate.js";
import { resolveModelPricing } from "../../core/agent/usage.js";
import { t } from "../../core/i18n/index.js";

export interface EstimateOptions {
  agent?: string;
  json?: boolean;
}

/** `polypus estimate "<task>"` — estimate effort/cost without implementing anything. */
export async function estimate(task: string, opts: EstimateOptions): Promise<void> {
  const config = await loadConfig();
  const agentConfig = resolveAgent(config, opts.agent);
  const resolved = createProvider(agentConfig);
  const pricing = await resolveModelPricing(resolved.config);
  const est = await estimateTask(task, resolved, pricing);

  if (opts.json) {
    process.stdout.write(JSON.stringify({ estimate: est }) + "\n");
    return;
  }

  console.log(pc.bold(t("estimate.header")));
  console.log(`  ${t("estimate.complexity")}: ${pc.cyan(est.complexity)}`);
  console.log(`  ${t("estimate.steps")}: ~${est.estimatedSteps}`);
  console.log(`  ${t("estimate.tokens")}: ~${fmtTokens(est.estimatedTokens)}`);
  console.log(`  ${t("estimate.cost")}: ${pc.green(est.costLabel)}`);
  if (est.rationale) console.log(pc.dim(`  ${est.rationale}`));
  if (est.risks) console.log(pc.dim(`  ⚠ ${est.risks}`));
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}
