import pc from "picocolors";
import { listSessions, rewindSession } from "../../core/agent/session-store.js";
import { listCheckpoints, restoreToCheckpoint } from "../../core/agent/checkpoints.js";
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

/**
 * `polypus checkpoints <id>` — list a session's file checkpoints; with
 * `--restore <n>` roll the workspace back to the state before checkpoint `n`
 * (optionally a single `--file`). Independent of git. `--json` for callers.
 */
export async function checkpointsCmd(
  id: string,
  opts: { restore?: string; file?: string; dir?: string; json?: boolean },
): Promise<void> {
  if (opts.restore === undefined) {
    const cps = await listCheckpoints(id);
    if (opts.json) {
      process.stdout.write(JSON.stringify({ ok: true, checkpoints: cps }) + "\n");
      return;
    }
    if (cps.length === 0) {
      console.log(pc.yellow(t("checkpoints.empty")));
      return;
    }
    console.log(pc.bold(t("checkpoints.header", { id })));
    for (const c of cps) {
      const when = c.ts.replace("T", " ").slice(0, 16);
      const files = c.files.map((f) => f.path).join(", ");
      console.log(`  ${pc.cyan(String(c.index))}  ${pc.dim(when)}  ${pc.dim(`[${c.tool}]`)}  ${files}`);
    }
    console.log(pc.dim("\n" + t("checkpoints.hint")));
    return;
  }

  const index = Math.max(1, Number(opts.restore) || 0);
  const workspace = opts.dir ?? process.cwd();
  const res = await restoreToCheckpoint(workspace, id, index, { file: opts.file });
  if (opts.json) {
    process.stdout.write(JSON.stringify({ ok: true, ...res }) + "\n");
    return;
  }
  const n = res.restored.length + res.deleted.length;
  console.log(pc.green(`↺ ${t("checkpoints.restored", { n, index })}`));
  if (res.restored.length) console.log(pc.dim("  " + res.restored.join(", ")));
  if (res.deleted.length) console.log(pc.dim("  ✗ " + res.deleted.join(", ")));
  if (res.skipped.length) console.log(pc.yellow("  ⚠ " + res.skipped.join(", ")));
}
