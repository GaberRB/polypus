import pc from "picocolors";
import { AgentConfig, ProviderKind, ToolMode } from "../../core/config/schema.js";
import { findAgent, loadConfig, saveConfig } from "../../core/config/store.js";
import { DEFAULT_BASE_URL, REQUIRES_API_KEY } from "../../core/providers/defaults.js";
import { t } from "../../core/i18n/index.js";

export interface AddAgentOptions {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  toolMode?: string;
  setDefault?: boolean;
}

/** `polypus add-agent <name> --provider <p> --model <m> [--api-key ...] [--base-url ...]` */
export async function addAgent(name: string, opts: AddAgentOptions): Promise<void> {
  const config = await loadConfig();

  if (findAgent(config, name)) {
    throw new Error(t("agent.exists", { name }));
  }

  const provider = ProviderKind.parse(opts.provider);
  const baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL[provider];
  if (!baseUrl) {
    throw new Error(t("agent.needBaseUrl", { provider }));
  }
  if (REQUIRES_API_KEY[provider] && !opts.apiKey) {
    throw new Error(t("agent.needApiKey", { provider }));
  }

  const agent = AgentConfig.parse({
    name,
    provider,
    model: opts.model,
    apiKey: opts.apiKey,
    baseUrl,
    toolMode: ToolMode.parse(opts.toolMode ?? "auto"),
  });

  config.agents.push(agent);
  if (opts.setDefault || config.agents.length === 1) {
    config.defaultAgent = name;
  }
  await saveConfig(config);

  console.log(
    pc.green(t("agent.added", { name: pc.bold(name) })) +
      ` (${provider} · ${opts.model})` +
      (config.defaultAgent === name ? pc.dim(` [${t("common.default")}]`) : ""),
  );
}
