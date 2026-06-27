import pc from "picocolors";
import { listSessions, rewindSession } from "../../core/agent/session-store.js";
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

/**
 * `polypus rewind <id> --turns <n>` — fork a session truncated to its first `n`
 * user turns (non-destructive). Prints the new session id; `--json` emits
 * `{ ok, sessionId }` for programmatic callers (e.g. the VSCode extension).
 */
export async function rewind(id: string, opts: { turns?: string; json?: boolean }): Promise<void> {
  const turns = Math.max(0, Number(opts.turns ?? 0) || 0);
  const newId = await rewindSession(id, turns);
  if (opts.json) {
    process.stdout.write(JSON.stringify({ ok: Boolean(newId), sessionId: newId ?? null }) + "\n");
    return;
  }
  if (!newId) {
    console.log(pc.red(t("sessions.notFound", { id })));
    return;
  }
  console.log(pc.green(`↺ ${newId}`));
}
