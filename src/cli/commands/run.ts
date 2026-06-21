import pc from "picocolors";
import * as p from "@clack/prompts";
import type { PermissionMode } from "../../core/config/schema.js";
import { loadConfig, resolveAgent } from "../../core/config/store.js";
import { createProvider } from "../../core/providers/registry.js";
import { PermissionEngine, type ConfirmRequest, type ConfirmResult } from "../../core/permissions/modes.js";
import { hunkLabel, type Hunk } from "../../core/permissions/diff.js";
import { runAgent, type AgentEvents, type RunResult } from "../../core/agent/loop.js";
import { resolveMentions } from "../../core/context/mentions.js";
import { buildVerifyFeedback, detectChecks, runChecks } from "../../core/agent/verify.js";
import {
  estimateCost,
  fmtUsd,
  recordUsage,
  resolveModelPricing,
  type ModelPricing,
} from "../../core/agent/usage.js";
import {
  deriveTitle,
  latestSession,
  loadSession,
  newSessionId,
  saveSession,
  type SessionRecord,
} from "../../core/agent/session-store.js";
import { createJsonCollector } from "./json-output.js";
import type { Message } from "../../core/providers/types.js";
import { startRepl, type ReplContext } from "../../ui/repl.js";
import { runSwarmSession } from "./swarm.js";
import { printWelcome } from "../../ui/banner.js";
import { Spinner } from "../../ui/spinner.js";
import { t } from "../../core/i18n/index.js";

export interface RunOptions {
  agent?: string;
  mode?: string;
  maxSteps?: string;
  /** Headless mode: emit a single JSON object instead of the colored TUI. */
  json?: boolean;
  /** After the agent finishes, run project checks and iterate until they pass. */
  verify?: boolean;
  /** Abort the run when the estimated session cost reaches this USD amount. */
  budget?: string;
  /** Resume the most recently saved session. */
  continue?: boolean;
  /** Resume a specific saved session by id. */
  resume?: string;
}

/** How many times the agent may re-try to make the verification checks pass. */
const MAX_VERIFY_FIXES = 3;

/** `polypus run [task]` — one-shot if a task is given, otherwise an interactive REPL. */
export async function run(task: string | undefined, opts: RunOptions): Promise<void> {
  let config = await loadConfig();
  const workspace = process.cwd();

  // Resume/continue: seed from a saved session.
  let seeded: SessionRecord | undefined;
  if (opts.resume) {
    seeded = await loadSession(opts.resume);
    if (!seeded) throw new Error(t("sessions.notFound", { id: opts.resume }));
  } else if (opts.continue) {
    seeded = await latestSession();
    if (!seeded && !opts.json) console.log(pc.dim(t("sessions.noneToContinue")));
  }

  const agentConfig = resolveAgent(config, opts.agent ?? seeded?.agentName);

  const session: SessionState = {
    id: seeded?.id ?? newSessionId(),
    title: seeded?.title ?? "",
    agentName: agentConfig.name,
    mode: (opts.mode as PermissionMode) ?? seeded?.mode ?? config.permissions.mode,
    allow: config.permissions.allow,
    deny: config.permissions.deny,
    allowedCommands: config.permissions.allowedCommands,
    maxSteps: opts.maxSteps ? Number(opts.maxSteps) : undefined,
    history: seeded?.messages ?? [],
    budget: opts.budget ? Number(opts.budget) : undefined,
    costUsd: 0,
  };

  if (seeded && !opts.json) {
    console.log(pc.dim(t("sessions.resumed", { id: seeded.id, n: seeded.messages.length })));
  }

  // Resolve the active agent freshly each run so /agent, /add and /remove work.
  const runTask = async (taskText: string): Promise<void> => {
    const active = resolveAgent(config, session.agentName);
    const resolved = createProvider(active);
    await executeTask(taskText, resolved, workspace, session);
  };

  if (opts.json && !task) throw new Error(t("run.jsonNeedsTask"));

  if (task) {
    const resolved = createProvider(agentConfig);
    if (!opts.json) {
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
    }
    await executeTask(task, resolved, workspace, session, opts.json ?? false, opts.verify ?? false);
    if (session.budget !== undefined && !opts.json) {
      console.log(pc.dim(t("budget.session", { spent: fmtUsd(session.costUsd), budget: fmtUsd(session.budget) })));
    }
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
    runSwarm: (taskText) => runSwarmSession(taskText, config, { workspace }),
    getConfig: () => config,
    reload: async () => {
      config = await loadConfig();
    },
  };
  await startRepl(ctx);
}

export interface SessionState {
  /** Stable id used to persist/resume this session. */
  id: string;
  /** Short human title (first task), for `polypus sessions`. */
  title: string;
  /** Name of the currently active agent (switchable via /agent). */
  agentName: string;
  mode: PermissionMode;
  allow: string[];
  deny: string[];
  allowedCommands: string[];
  maxSteps?: number;
  history: Message[];
  /** Optional USD spend cap for the whole session (from --budget). */
  budget?: number;
  /** Estimated USD spent so far this session. */
  costUsd: number;
}

async function executeTask(
  task: string,
  resolved: ReturnType<typeof createProvider>,
  workspace: string,
  session: SessionState,
  json = false,
  verify = false,
): Promise<void> {
  // Inject @file / @dir mentions into the task as explicit context before sending.
  const mention = await resolveMentions(task, {
    workspace,
    allow: session.allow,
    deny: session.deny,
  });
  if (mention.injected.length > 0) {
    task = mention.task;
    if (!json) console.log(pc.dim(`↳ @ ${mention.injected.join(", ")}`));
  }

  const spinner = new Spinner();
  const controller = new AbortController();
  const cancel = listenForCancel(controller); // ESC / Ctrl+C aborts the task
  const collector = json ? createJsonCollector() : undefined;

  // Cost estimation + budget enforcement (no-op when pricing is unknown).
  const pricing = await resolveModelPricing(resolved.config);
  let budgetHit = false;
  const baseEvents = collector ? collector.events : renderEvents(spinner);
  const events: AgentEvents = {
    ...baseEvents,
    onUsage(u) {
      baseEvents.onUsage?.(u);
      if (session.budget !== undefined && pricing && !controller.signal.aborted) {
        if (session.costUsd + estimateCost(u, pricing) >= session.budget) {
          budgetHit = true;
          controller.abort();
        }
      }
    },
  };

  const permissions = new PermissionEngine({
    mode: session.mode,
    policy: { workspace, allow: session.allow, deny: session.deny },
    allowedCommands: session.allowedCommands,
    // Headless runs have no TTY for confirmations — use --mode bypass instead.
    confirm: json
      ? async () => false
      : async (req) => {
          spinner.stop();
          cancel.pause(); // hand stdin to the clack prompt
          const ok = await confirmAction(req);
          cancel.resume();
          return ok;
        },
  });

  const runOnce = (taskText: string): Promise<RunResult> =>
    runAgent({
      task: taskText,
      workspace,
      agent: resolved,
      permissions,
      promptContext: { workspace, mode: session.mode, allow: session.allow },
      history: session.history,
      maxSteps: session.maxSteps,
      signal: controller.signal,
      events,
    });

  if (!json) spinner.start(t("ui.thinking"));
  let result: RunResult;
  try {
    result = await runOnce(task);
    session.history = result.messages;

    // Test-driven verification: run project checks and feed failures back to
    // the agent until they pass or the retry budget is exhausted.
    if (verify && result.reason === "finished" && !controller.signal.aborted) {
      result = await runVerification(runOnce, workspace, session, spinner, json, controller.signal, result);
    }
  } finally {
    spinner.stop();
    cancel.dispose();
  }

  // Persist the conversation so it can be resumed (secrets are redacted on save).
  if (!session.title) session.title = deriveTitle(session.history);
  await saveSession({
    id: session.id,
    updatedAt: new Date().toISOString(),
    title: session.title,
    agentName: session.agentName,
    mode: session.mode,
    messages: session.history,
  }).catch(() => {/* best-effort persistence */});

  // Account for estimated spend and persist analytics (best-effort).
  const runCost = pricing ? estimateCost(result.usage, pricing) : 0;
  session.costUsd += runCost;
  await recordUsage({
    ts: new Date().toISOString(),
    agent: resolved.config.name,
    provider: resolved.config.provider,
    model: resolved.config.model,
    promptTokens: result.usage.promptTokens,
    completionTokens: result.usage.completionTokens,
    costUsd: runCost,
  });

  if (collector) {
    process.stdout.write(JSON.stringify(collector.build(result)) + "\n");
    return;
  }

  if (budgetHit) {
    console.log(pc.yellow("\n" + t("budget.hit", { budget: fmtUsd(session.budget ?? 0) })));
  }

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
    const tokensLine = t("ui.tokens", {
      total: fmtTokens(total),
      in: fmtTokens(result.usage.promptTokens),
      out: fmtTokens(result.usage.completionTokens),
    });
    const cost = pricing ? ` · ~${fmtUsd(runCost)}` : "";
    console.log(pc.dim("↳ " + tokensLine + cost));
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

async function confirmAction(req: ConfirmRequest): Promise<ConfirmResult> {
  // Writes in review mode: show the real diff and allow approve-all / reject /
  // (when there is more than one hunk) per-hunk selection.
  if (req.kind === "write" && req.hunks && req.hunks.length > 0) {
    renderDiff(req.hunks);
    const options = [
      { value: "approve", label: t("review.approveAll") },
      { value: "reject", label: t("review.reject") },
      ...(req.hunks.length > 1 ? [{ value: "hunks", label: t("review.pickHunks") }] : []),
    ];
    const choice = await p.select({ message: t("run.confirm", { summary: req.summary }), options });
    if (p.isCancel(choice) || choice === "reject") return false;
    if (choice === "approve") return true;

    const selected = await p.multiselect({
      message: t("review.selectHunks"),
      options: req.hunks.map((h, i) => ({ value: i, label: hunkLabel(h) })),
      required: false,
    });
    if (p.isCancel(selected)) return false;
    return selected as number[];
  }

  if (req.preview) console.log(pc.dim(req.preview));
  const answer = await p.confirm({ message: t("run.confirm", { summary: req.summary }) });
  if (p.isCancel(answer)) return false;
  return answer === true;
}

/**
 * Run the project's verification checks; on failure feed the output back to the
 * agent and re-run, up to MAX_VERIFY_FIXES times. Returns the latest run result.
 */
async function runVerification(
  runOnce: (task: string) => Promise<RunResult>,
  workspace: string,
  session: SessionState,
  spinner: Spinner,
  json: boolean,
  signal: AbortSignal,
  initial: RunResult,
): Promise<RunResult> {
  const checks = await detectChecks(workspace);
  if (checks.length === 0) {
    if (!json) console.log(pc.dim(t("verify.noChecks")));
    return initial;
  }
  let result = initial;
  for (let fix = 0; ; fix++) {
    if (signal.aborted) return result;
    if (!json) spinner.start(t("verify.running"));
    const results = await runChecks(workspace, checks);
    spinner.stop();
    const failed = results.filter((r) => !r.ok);
    if (failed.length === 0) {
      if (!json) console.log(pc.green("✓ " + t("verify.passed")));
      return result;
    }
    if (fix >= MAX_VERIFY_FIXES) {
      if (!json) console.log(pc.yellow("⚠ " + t("verify.giveUp", { n: failed.length })));
      return result;
    }
    if (!json) {
      console.log(pc.yellow("✗ " + t("verify.failed", { n: failed.length, attempt: fix + 1 })));
    }
    if (!json) spinner.start(t("ui.thinking"));
    result = await runOnce(buildVerifyFeedback(failed));
    spinner.stop();
    session.history = result.messages;
  }
}

/** Print a colored unified diff for the hunks of a pending write. */
function renderDiff(hunks: Hunk[]): void {
  for (const h of hunks) {
    console.log(pc.cyan(`@@ -${h.oldStart + 1},${h.oldCount} +${h.newStart + 1},${h.newCount} @@`));
    for (const l of h.lines) {
      if (l.type === "+") console.log(pc.green(`+${l.text}`));
      else if (l.type === "-") console.log(pc.red(`-${l.text}`));
      else console.log(pc.dim(` ${l.text}`));
    }
  }
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
