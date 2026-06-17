import pc from "picocolors";
import { findAgent, loadConfig, saveConfig } from "../../core/config/store.js";
import { t } from "../../core/i18n/index.js";

/** `polypus remove-agent <name>` */
export async function removeAgent(name: string): Promise<void> {
  const config = await loadConfig();
  if (!findAgent(config, name)) {
    throw new Error(t("agent.notFound", { name }));
  }
  config.agents = config.agents.filter((a) => a.name !== name);
  if (config.defaultAgent === name) {
    config.defaultAgent = config.agents[0]?.name;
  }
  await saveConfig(config);
  console.log(pc.green(t("agent.removed", { name: pc.bold(name) })));
}
