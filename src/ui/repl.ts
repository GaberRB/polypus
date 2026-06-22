import pc from "picocolors";
import type { SessionState } from "../cli/commands/run.js";
import type { PermissionMode, PolypusConfig } from "../core/config/schema.js";
import { findAgent, loadConfig, saveConfig } from "../core/config/store.js";
import { addAgentInteractive } from "./wizard.js";
import { listSessions, loadSession } from "../core/agent/session-store.js";
import { t } from "../core/i18n/index.js";
import { promptLabel } from "./banner.js";
import { readLine } from "./line-reader.js";

export interface ReplContext {
  session: SessionState;
  /** Run a task with the currently active agent. */
  runTask(task: string): Promise<void>;
  /** Run a task as a swarm across the configured agents (parallel worktrees). */
  runSwarm(task: string, opts?: { workers?: number }): Promise<void>;
  /** Current in-memory config. */
  getConfig(): PolypusConfig;
  /** Re-read config from disk (after add/remove). */
  reload(): Promise<void>;
}

/**
 * Interactive session loop. A fresh readline is opened only to read each line
 * and closed before any work runs — tasks (review-mode confirmations) and the
 * /add wizard use @clack/prompts, which needs sole control of stdin. Keeping a
 * persistent readline open across those would corrupt stdin and drop the REPL.
 */
export async function startRepl(ctx: ReplContext): Promise<void> {
  for (;;) {
    const line = await readLine(promptLabel(ctx.session.mode));
    if (line === null) break; // EOF / Ctrl+D
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (!trimmed.startsWith("/")) {
      await ctx.runTask(trimmed);
      continue;
    }

    const [cmd = "", ...rest] = trimmed.slice(1).split(/\s+/);
    const arg = rest.join(" ").trim();

    if (cmd === "exit" || cmd === "quit") break;

    if (cmd === "add") {
      const name = await addAgentInteractive().catch((e) => {
        console.log(pc.red(`✗ ${(e as Error).message}`));
        return undefined;
      });
      await ctx.reload();
      if (name) {
        ctx.session.agentName = name;
        console.log(pc.green(t("repl.switchedTo", { name })));
      }
      continue;
    }

    await handleCommand(cmd, arg, ctx);
  }
}

async function handleCommand(cmd: string, arg: string, ctx: ReplContext): Promise<void> {
  const { session } = ctx;

  switch (cmd) {
    case "help":
      console.log(t("repl.help"));
      return;

    case "plan":
    case "review":
    case "bypass":
      session.mode = cmd as PermissionMode;
      console.log(pc.dim(t("repl.modeChanged", { mode: cmd })));
      return;

    case "allow":
      if (arg) {
        session.allow = [...session.allow, arg];
        console.log(pc.dim(t("repl.allowAdded", { glob: arg })));
      } else {
        console.log(pc.dim(t("repl.allowShow", { mode: session.mode, allow: session.allow.join(", ") })));
      }
      return;

    case "reset":
      session.history = [];
      console.log(pc.dim(t("repl.historyCleared")));
      return;

    case "sessions": {
      const all = await listSessions();
      if (all.length === 0) {
        console.log(pc.yellow(t("sessions.empty")));
        return;
      }
      console.log(pc.bold(t("sessions.header")));
      for (const s of all) {
        console.log(`  ${pc.cyan(s.id)} ${pc.dim(`[${s.messageCount} msgs]`)} ${s.title}`);
      }
      return;
    }

    case "resume": {
      if (!arg) {
        console.log(pc.yellow(t("repl.needName", { usage: "/resume <id>" })));
        return;
      }
      const record = await loadSession(arg);
      if (!record) {
        console.log(pc.red(t("sessions.notFound", { id: arg })));
        return;
      }
      session.id = record.id;
      session.title = record.title;
      session.agentName = record.agentName;
      session.mode = record.mode;
      session.history = record.messages;
      console.log(pc.green(t("sessions.resumed", { id: record.id, n: record.messages.length })));
      return;
    }

    case "swarm": {
      if (!arg) {
        console.log(pc.yellow(t("repl.needName", { usage: "/swarm [--workers N] <task>" })));
        return;
      }
      // Parse `--workers N` (or --workers=N) out of the line; the rest is the task.
      let workers: number | undefined;
      const swarmTask = arg
        .replace(/--workers[=\s]+(\d+)/i, (_, n: string) => {
          workers = Number(n);
          return "";
        })
        .replace(/\s+/g, " ")
        .trim();
      if (!swarmTask) {
        console.log(pc.yellow(t("repl.needName", { usage: "/swarm [--workers N] <task>" })));
        return;
      }
      try {
        await ctx.runSwarm(swarmTask, { workers });
      } catch (e) {
        console.log(pc.red(`✗ ${(e as Error).message}`));
      }
      return;
    }

    case "agents":
      printAgents(ctx.getConfig(), session.agentName);
      return;

    case "agent": {
      if (!arg) {
        console.log(pc.yellow(t("repl.needName", { usage: "/agent <name>" })));
        return;
      }
      if (!findAgent(ctx.getConfig(), arg)) {
        console.log(pc.red(t("agent.notFound", { name: arg })));
        return;
      }
      session.agentName = arg;
      console.log(pc.green(t("repl.agentSwitched", { name: arg })));
      return;
    }

    case "remove": {
      if (!arg) {
        console.log(pc.yellow(t("repl.needName", { usage: "/remove <name>" })));
        return;
      }
      await removeAgent(arg, ctx);
      return;
    }

    default:
      console.log(pc.yellow(t("repl.unknown", { cmd })));
  }
}

function printAgents(config: PolypusConfig, activeName: string): void {
  if (config.agents.length === 0) {
    console.log(pc.yellow(t("agent.none")));
    return;
  }
  console.log(pc.bold(t("agent.listHeader")));
  for (const a of config.agents) {
    const active = a.name === activeName;
    console.log(
      `  ${active ? pc.green("●") : pc.dim("○")} ${pc.bold(a.name)} ` +
        pc.dim(`(${a.provider} · ${a.model} · ${a.toolMode})`) +
        (config.defaultAgent === a.name ? pc.dim(` [${t("common.default")}]`) : ""),
    );
  }
}

async function removeAgent(name: string, ctx: ReplContext): Promise<void> {
  const config = await loadConfig();
  if (!findAgent(config, name)) {
    console.log(pc.red(t("agent.notFound", { name })));
    return;
  }
  config.agents = config.agents.filter((a) => a.name !== name);
  if (config.defaultAgent === name) config.defaultAgent = config.agents[0]?.name;
  await saveConfig(config);
  await ctx.reload();
  console.log(pc.green(t("agent.removed", { name })));

  // If the active agent was removed, fall back to another one.
  if (ctx.session.agentName === name) {
    const next = config.defaultAgent ?? config.agents[0]?.name;
    if (next) {
      ctx.session.agentName = next;
      console.log(pc.dim(t("repl.switchedTo", { name: next })));
    } else {
      console.log(pc.yellow(t("repl.noAgentsLeft")));
    }
  }
}
