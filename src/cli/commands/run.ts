import pc from "picocolors";
import * as p from "@clack/prompts";
import type { PermissionMode } from "../../core/config/schema.js";
import { loadConfig, resolveAgent } from "../../core/config/store.js";
import { createProvider } from "../../core/providers/registry.js";
import { PermissionEngine, type ConfirmRequest } from "../../core/permissions/modes.js";
import { runAgent, type AgentEvents } from "../../core/agent/loop.js";
import type { Message } from "../../core/providers/types.js";
import { startRepl, type ReplContext } from "../../ui/repl.js";
import { printWelcome } from "../../ui/banner.js";
import { Spinner } from "../../ui/spinner.js";
import { t } from "../../core/i18n/index.js";

export interface RunOptions {
  agent?: string;
  mode?: string;
  maxSteps?: string;
}

/** `polypus run [task]` — one-shot if a task is given, otherwise an interactive REPL. */
export async function run(task: string | undefined, opts: RunOptions): Promise<void> {
  let config = await loadConfig();
  const agentConfig = resolveAgent(config, opts.agent);
  const workspace = process.cwd();

  const session: SessionState = {
    agentName: agentConfig.name,
    mode: (opts.mode as PermissionMode) ?? config.permissions.mode,
    allow: config.permissions.allow,
    deny: config.permissions.deny,
    allowedCommands: config.permissions.allowedCommands,
    maxSteps: opts.maxSteps ? Number(opts.maxSteps) : undefined,
    history: [],
  };

  // Resolve the active agent freshly each run so /agent, /add and /remove work.
  const runTask = async (taskText: string): Promise<void> => {
    const active = resolveAgent(config, session.agentName);
    const resolved = createProvider(active);
    await executeTask(taskText, resolved, workspace, session);
  };

  if (task) {
    const resolved = createProvider(agentConfig);
    console.log(
      pc.dim(
        t("run.status", {
          name: resolved.config.name,
          provider: resolved.config.provider,
          model: resolved.config.model,
          toolMode: resolved.toolMode,
          mode: session.mode,
        }),
      ),
    );
    await executeTask(task, resolved, workspace, session);
    return;
  }

  // Interactive: full welcome screen with the animated banner.
  const resolved = createProvider(agentConfig);
  await printWelcome({
    agentName: resolved.config.name,
    provider: resolved.config.provider,
    model: resolved.config.model,
    toolMode: resolved.toolMode,
    mode: session.mode,
    workspace,
  });

  const ctx: ReplContext = {
    session,
    runTask,
    getConfig: () => config,
    reload: async () => {
      config = await loadConfig();
    },
  };
  await startRepl(ctx);
}

export interface SessionState {
  /** Name of the currently active agent (switchable via /agent). */
  agentName: string;
  mode: PermissionMode;
  allow: string[];
  deny: string[];
  allowedCommands: string[];
  maxSteps?: number;
  history: Message[];
}

async function executeTask(
  task: string,
  resolved: ReturnType<typeof createProvider>,
  workspace: string,
  session: SessionState,
): Promise<void> {
  const spinner = new Spinner();
  const controller = new AbortController();
  const cancel = listenForCancel(controller); // ESC / Ctrl+C aborts the task

  const permissions = new PermissionEngine({
    mode: session.mode,
    policy: { workspace, allow: session.allow, deny: session.deny },
    allowedCommands: session.allowedCommands,
    confirm: async (req) => {
      spinner.stop();
      cancel.pause(); // hand stdin to the clack prompt
      const ok = await confirmAction(req);
      cancel.resume();
      return ok;
    },
  });

  spinner.start(t("ui.thinking"));
  let result;
  try {
    result = await runAgent({
      task,
      workspace,
      agent: resolved,
      permissions,
      promptContext: { workspace, mode: session.mode, allow: session.allow },
      history: session.history,
      maxSteps: session.maxSteps,
      signal: controller.signal,
      events: renderEvents(spinner),
    });
  } finally {
    spinner.stop();
    cancel.dispose();
  }

  session.history = result.messages;

  if (result.reason === "finished") {
    console.log(pc.green("\n" + t("run.done", { steps: result.steps })) + (result.summary ? ` ${result.summary}` : ""));
  } else if (result.reason === "cancelled") {
    console.log(pc.dim("\n" + t("run.cancelled")));
  } else if (result.reason === "stalled" || result.reason === "maxsteps") {
    console.log(pc.yellow("\n" + t("run.stopped", { steps: result.steps })));
  }
  // "reply" → the assistant simply talked to the user; nothing more to print.

  if (result.usage.promptTokens || result.usage.completionTokens) {
    const total = result.usage.promptTokens + result.usage.completionTokens;
    console.log(
      pc.dim(
        "↳ " +
          t("ui.tokens", {
            total: fmtTokens(total),
            in: fmtTokens(result.usage.promptTokens),
            out: fmtTokens(result.usage.completionTokens),
          }),
      ),
    );
  }
}

/** Compact token count, e.g. 1234 → "1.2k". */
function fmtTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

interface CancelListener {
  pause(): void;
  resume(): void;
  dispose(): void;
}

/**
 * While a task runs, listen on raw stdin for ESC (0x1b) or Ctrl+C (0x03) and
 * abort the controller. pause()/resume() let a clack confirmation borrow stdin.
 * No-op when stdin is not a TTY.
 */
function listenForCancel(controller: AbortController): CancelListener {
  const stdin = process.stdin;
  if (!stdin.isTTY) return { pause() {}, resume() {}, dispose() {} };

  const onData = (buf: Buffer) => {
    // Only a lone ESC / Ctrl+C — multi-byte sequences (arrow keys) are ignored.
    if (buf.length === 1 && (buf[0] === 0x1b || buf[0] === 0x03)) controller.abort();
  };

  let active = false;
  const attach = () => {
    if (active) return;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
    active = true;
  };
  const detach = () => {
    if (!active) return;
    stdin.off("data", onData);
    stdin.setRawMode(false);
    stdin.pause();
    active = false;
  };

  attach();
  return { pause: detach, resume: attach, dispose: detach };
}

async function confirmAction(req: ConfirmRequest): Promise<boolean> {
  if (req.preview) console.log(pc.dim(req.preview));
  const answer = await p.confirm({ message: t("run.confirm", { summary: req.summary }) });
  if (p.isCancel(answer)) return false;
  return answer === true;
}

function renderEvents(spinner: Spinner): AgentEvents {
  return {
    onStep() {
      spinner.start(t("ui.thinking"));
    },
    onUsage(usage) {
      const total = usage.promptTokens + usage.completionTokens;
      if (total > 0) spinner.setSuffix(t("ui.tokensShort", { total: fmtTokens(total) }));
    },
    onAssistantText(text) {
      spinner.stop();
      if (text.trim()) console.log(pc.cyan(text.trim()));
    },
    onToolCall(call) {
      spinner.stop();
      const arg = call.name === "run_command" ? call.arguments.command : call.arguments.path;
      console.log(pc.dim(`  → ${call.name}${arg ? ` ${String(arg)}` : ""}`));
      spinner.start(t("ui.running", { tool: call.name }));
    },
    onToolResult(_call, result) {
      spinner.stop();
      const head = result.output.split("\n")[0] ?? "";
      console.log((result.ok ? pc.green("    ✓ ") : pc.red("    ✗ ")) + pc.dim(head.slice(0, 120)));
    },
    onReprompt(attempt) {
      spinner.stop();
      console.log(pc.yellow("  " + t("run.reprompt", { attempt })));
    },
    onCorrection() {
      spinner.stop();
      console.log(pc.yellow("    ↻ " + t("run.autocorrect")));
    },
  };
}
