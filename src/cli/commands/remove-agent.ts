import pc from "picocolors";
import { findAgent, loadConfig, saveConfig } from "../../core/config/store.js";

/** `polypus remove-agent <name>` */
export async function removeAgent(name: string): Promise<void> {
  const config = await loadConfig();
  if (!findAgent(config, name)) {
    throw new Error(`No agent named "${name}".`);
  }
  config.agents = config.agents.filter((a) => a.name !== name);
  if (config.defaultAgent === name) {
    config.defaultAgent = config.agents[0]?.name;
  }
  await saveConfig(config);
  console.log(pc.green(`✓ Removed agent ${pc.bold(name)}`));
}
