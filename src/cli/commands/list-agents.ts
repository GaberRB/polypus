import pc from "picocolors";
import { loadConfig } from "../../core/config/store.js";

/** `polypus list-agents` */
export async function listAgents(): Promise<void> {
  const config = await loadConfig();
  if (config.agents.length === 0) {
    console.log(pc.yellow("No agents configured. Run `polypus setup` or `polypus add-agent`."));
    return;
  }
  console.log(pc.bold("Agents:"));
  for (const a of config.agents) {
    const isDefault = config.defaultAgent === a.name;
    const key = a.apiKey ? pc.dim(" · key set") : pc.dim(" · no key");
    console.log(
      `  ${isDefault ? pc.green("●") : pc.dim("○")} ${pc.bold(a.name)} ` +
        pc.dim(`(${a.provider} · ${a.model} · ${a.toolMode})`) +
        key +
        (isDefault ? pc.green(" [default]") : ""),
    );
  }
  console.log(
    pc.dim(`\nPermissions: mode=${config.permissions.mode}, allow=[${config.permissions.allow.join(", ")}]`),
  );
}
