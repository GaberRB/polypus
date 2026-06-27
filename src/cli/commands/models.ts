import pc from "picocolors";
import * as p from "@clack/prompts";
import { loadConfig, resolveSecret } from "../../core/config/store.js";
import {
  filterModels,
  fmtContext,
  fmtPrice,
  listOpenRouterModels,
  type ModelSort,
  type OpenRouterModel,
} from "../../core/providers/openrouter.js";
import { t } from "../../core/i18n/index.js";

export interface ModelsCliOptions {
  search?: string;
  tools?: boolean;
  free?: boolean;
  maxPrice?: string;
  minPopularity?: string;
  sort?: string;
  limit?: string;
  /** Emit the filtered models as a JSON array (for UIs) instead of the table. */
  json?: boolean;
}

/** `polypus models` — list OpenRouter models with filters. */
export async function models(opts: ModelsCliOptions): Promise<void> {
  const apiKey = await resolveOpenRouterKey();

  const spin = opts.json ? undefined : p.spinner();
  spin?.start(t("models.fetching"));
  let all: OpenRouterModel[];
  try {
    all = await listOpenRouterModels(apiKey);
    spin?.stop(pc.green("✓ OpenRouter"));
  } catch (err) {
    if (opts.json) {
      process.stdout.write(JSON.stringify({ ok: false, error: (err as Error).message, models: [] }) + "\n");
      return;
    }
    spin?.stop(pc.red(t("models.fetchError", { msg: (err as Error).message })), 2);
    return;
  }

  const filtered = filterModels(all, {
    search: opts.search,
    tools: opts.tools ? "tools" : "any",
    freeOnly: Boolean(opts.free),
    maxPrice: opts.maxPrice !== undefined ? Number(opts.maxPrice) : undefined,
    minPopularity: opts.minPopularity !== undefined ? Number(opts.minPopularity) : undefined,
    sort: (opts.sort as ModelSort) ?? "price",
  });

  const limit = opts.limit ? Number(opts.limit) : 30;
  if (opts.json) {
    process.stdout.write(JSON.stringify({ ok: true, models: filtered.slice(0, limit) }) + "\n");
    return;
  }
  printModelsTable(filtered, limit, all.length);
}

/** Render a colored, aligned table of models. Exported for reuse by the wizard. */
export function printModelsTable(models: OpenRouterModel[], limit: number, total: number): void {
  console.log(pc.dim(t("models.legend")));
  if (models.length === 0) {
    console.log(pc.yellow(t("models.none")));
    return;
  }

  const rows = models.slice(0, limit);
  console.log(
    "  " +
      pc.dim(t("models.colTools").padEnd(6)) +
      pc.dim(t("models.colPrice").padEnd(16)) +
      pc.dim(t("models.colCtx").padEnd(9)) +
      pc.dim(t("models.colModel")),
  );
  for (const m of rows) {
    console.log("  " + modelRow(m));
  }
  console.log(pc.dim("\n" + t("models.shown", { shown: rows.length, total })));
}

function modelRow(m: OpenRouterModel): string {
  const tools = m.supportsTools ? pc.green("🛠".padEnd(5)) : pc.dim("—".padEnd(5));
  const price = `${fmtPrice(m.promptPrice)}/${fmtPrice(m.completionPrice)}`;
  const priceColored = (m.free ? pc.green : pc.yellow)(price.padEnd(16));
  const ctx = pc.cyan(fmtContext(m.contextLength).padEnd(9));
  return `${tools} ${priceColored}${ctx}${pc.bold(m.id)}`;
}

/** Best-effort OpenRouter key: env first, then a configured openrouter agent. */
async function resolveOpenRouterKey(): Promise<string | undefined> {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  try {
    const config = await loadConfig();
    const agent = config.agents.find((a) => a.provider === "openrouter" && a.apiKey);
    return agent ? resolveSecret(agent.apiKey) : undefined;
  } catch {
    return undefined;
  }
}
