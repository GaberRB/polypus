import pc from "picocolors";
import { loadConfig } from "../../core/config/store.js";
import { t } from "../../core/i18n/index.js";

/** `polypus list-agents` */
export async function listAgents(): Promise<void> {
  const config = await loadConfig();
  if (config.agents.length === 0) {
    console.log(pc.yellow(t("agent.none")));
    return;
  }
  console.log(pc.bold(t("agent.listHeader")));
  for (const a of config.agents) {
    const isDefault = config.defaultAgent === a.name;
    const key = pc.dim(` · ${a.apiKey ? t("common.keySet") : t("common.noKey")}`);
    console.log(
      `  ${isDefault ? pc.green("●") : pc.dim("○")} ${pc.bold(a.name)} ` +
        pc.dim(`(${a.provider} · ${a.model} · ${a.toolMode})`) +
        key +
        (isDefault ? pc.green(` [${t("common.default")}]`) : ""),
    );
  }
  console.log(
    pc.dim(
      "\n" + t("agent.permLine", { mode: config.permissions.mode, allow: config.permissions.allow.join(", ") }),
    ),
  );
}
