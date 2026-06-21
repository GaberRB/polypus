import pc from "picocolors";
import { listSessions } from "../../core/agent/session-store.js";
import { t } from "../../core/i18n/index.js";

/** `polypus sessions` — list saved sessions that can be resumed. */
export async function sessions(): Promise<void> {
  const all = await listSessions();
  if (all.length === 0) {
    console.log(pc.yellow(t("sessions.empty")));
    return;
  }
  console.log(pc.bold(t("sessions.header")));
  for (const s of all) {
    const when = s.updatedAt.replace("T", " ").slice(0, 16);
    console.log(
      `  ${pc.cyan(s.id)}  ${pc.dim(when)}  ${pc.dim(`[${s.agentName} · ${s.mode} · ${s.messageCount} msgs]`)}`,
    );
    console.log(`     ${s.title}`);
  }
  console.log(pc.dim("\n" + t("sessions.hint")));
}
