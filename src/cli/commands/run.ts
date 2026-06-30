import * as readline from "node:readline";
import pc from "picocolors";
import * as p from "@clack/prompts";
import {
  resolveExecution,
  type EmbeddingsConfig,
  type ExecutionConfig,
  type NetworkPolicy,
  type PermissionMode,
  type ResolvedExecution,
  type RetrievalConfig,
} from "../../core/config/schema.js";
import { loadConfig, resolveAgent, findCustomProvider } from "../../core/config/store.js";
import { gatherContext } from "../../core/context/auto-context.js";
import { createProvider, createCustomProvider } from "../../core/providers/registry.js";
import { PermissionEngine, type ConfirmRequest, type ConfirmResult } from "../../core/permissions/modes.js";
import { hunkLabel, type Hunk } from "../../core/permissions/diff.js";
import { runAgent, type AgentEvents, type RunResult } from "../../core/agent/loop.js";
import { resolveMentions } from "../../core/context/mentions.js";
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
import { loadHooks } from "../../core/agent/hooks.js";
import { loadCustomTools } from "../../core/tools/custom.js";
import { loadMcpTools } from "../../core/mcp/index.js";
import { loadSkills, makeUseSkillTool } from "../../core/skills/index.js";
import type { AskRequest } from "../../core/tools/types.js";
import { createJsonCollector, createNdjsonStreamer } from "./json-output.js";
import { createStreamAsk } from "./stream-ask.js";
import type { Message } from "../../core/providers/types.js";
import { startRepl, type ReplContext } from "../../ui/repl.js";
import { runSwarmSession } from "./swarm.js";
import { printWelcome } from "../../ui/banner.js";
import { Spinner } from "../../ui/spinner.js";
import { t } from "../../core/i18n/index.js";
import { listenForCancel } from "../../ui/cancel.js";

/**
 * Resolve a named agent from regular agents OR custom providers.
 * Accepts names with or without the "🔌 " prefix added by the VSCode switcher.
 * When name is empty and there are no regular agents, falls back to the first
 * custom provider so custom-only setups work without an explicit --agent flag.
 */
function resolveAnyAgent(
  config: Awaited<ReturnType<typeof loadConfig>>,
  name?: string,
): ReturnType<typeof createProvider> {
  const cleanName = name?.replace(/^🔌\s*/u, "") ?? name;

  // Explicit custom provider lookup.
  if (cleanName) {
    const cp = findCustomProvider(config, cleanName);
    if (cp) return createCustomProvider(cp);
  }

  // No name given (or empty) and no regular agents → use first custom provider.
  if (!cleanName && config.agents.length === 0 && config.customProviders?.length) {
    return createCustomProvider(config.customProviders[0]!);
  }

  return createProvider(resolveAgent(config, cleanName || undefined));
}

export interface RunOptions {
  agent?: string;
  /** Override the resolved agent's model for this run (OpenRouter model id). */
  model?: string;
  mode?: string;
  maxSteps?: string;
  /** Headless mode: emit a single JSON object instead of the colored TUI. */
  json?: boolean;
  /** With --json: emit NDJSON events live (one per line) instead of one object. */
  stream?: boolean;
  /** Force verification on (--verify) or off (--no-verify); undefined = profile/config. */
  verify?: boolean;
  /** Shortcut for the `fast` execution profile (verify/plan/auto-context off). */
  fast?: boolean;
  /** Shortcut for the `quality` execution profile (the default scaffolding on). */
  quality?: boolean;
  /** Stream the model's reasoning/chain-of-thought (when the model supports it). */
  think?: boolean;
  /** Abort the run when the estimated session cost reaches this USD amount. */
  budget?: string;
  /** Resume the most recently saved session. */
  continue?: boolean;
  /** Resume a specific saved session by id. */
  resume?: string;
}

/** Resolve the effective execution settings from config + CLI flags. */
function execFromOpts(cfg: ExecutionConfig, opts: RunOptions): ResolvedExecution {
  return resolveExecution(cfg, {
    profile: opts.fast ? "fast" : opts.quality ? "quality" : undefined,
    verify: opts.verify,
  });
}

/**
 * Token threshold above which old history is auto-compacted. Defaults to 120k,
 * overridable via POLYPUS_COMPACT_THRESHOLD; POLYPUS_NO_COMPACT disables it.
 */
function compactionThreshold(): number {
  if (process.env.POLYPUS_NO_COMPACT) return 0;
  const v = Number(process.env.POLYPUS_COMPACT_THRESHOLD);
  return Number.isFinite(v) && v > 0 ? v : 120_000;
}

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

  // Strip the "🔌 " prefix the VSCode switcher adds to custom provider names.
  const rawAgentName = opts.agent ?? seeded?.agentName;
  const cleanAgentName = rawAgentName?.replace(/^🔌\s*/u, "") ?? rawAgentName;
  const initialResolved = resolveAnyAgent(config, cleanAgentName);
  const agentConfig = initialResolved.config;
  // `--model` overrides the resolved agent's model (browse-and-run any OpenRouter model).
  if (opts.model) agentConfig.model = opts.model;

  const session: SessionState = {
    id: seeded?.id ?? newSessionId(),
    title: seeded?.title ?? "",
    agentName: agentConfig.name,
    mode: (opts.mode as PermissionMode) ?? seeded?.mode ?? config.permissions.mode,
    allow: config.permissions.allow,
    deny: config.permissions.deny,
    allowedCommands: config.permissions.allowedCommands,
    network: config.permissions.network,
    maxSteps: opts.maxSteps ? Number(opts.maxSteps) : undefined,
    history: seeded?.messages ?? [],
    budget: opts.budget ? Number(opts.budget) : undefined,
    costUsd: 0,
    exec: execFromOpts(config.execution, opts),
  };

  if (seeded && !opts.json) {
    console.log(pc.dim(t("sessions.resumed", { id: seeded.id, n: seeded.messages.length })));
  }

  // Resolve the active agent freshly each run so /agent, /add and /remove work.
  const runTask = async (taskText: string): Promise<void> => {
    const resolved = resolveAnyAgent(config, session.agentName);
    // isCustomProvider flows into promptContext inside executeTask via the resolved param.
    await executeTask(taskText, resolved, workspace, session, false, {
      embeddings: config.embeddings,
      retrieval: config.retrieval,
    });
  };

  if (opts.json && !task) throw new Error(t("run.jsonNeedsTask"));

  if (task) {
    const resolved = resolveAnyAgent(config, agentConfig.name);
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
    await executeTask(
      task,
      resolved,
      workspace,
      session,
      opts.json ?? false,
      { embeddings: config.embeddings, retrieval: config.retrieval },
      opts.stream ?? false,
      opts.think ?? false,
    );
    if (session.budget !== undefined && !opts.json) {
      console.log(pc.dim(t("budget.session", { spent: fmtUsd(session.costUsd), budget: fmtUsd(session.budget) })));
    }
    return;
  }

  // Interactive: full welcome screen with the animated banner.
  const resolved = resolveAnyAgent(config, agentConfig.name);
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
    workspace,
    runTask,
    runSwarm: (taskText, swarmOpts) => runSwarmSession(taskText, config, { workspace, ...swarmOpts }),
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
  network: NetworkPolicy;
  maxSteps?: number;
  history: Message[];
  /** Optional USD spend cap for the whole session (from --budget). */
  budget?: number;
  /** Estimated USD spent so far this session. */
  costUsd: number;
  /** Effective execution settings (verify/plan-first/auto-context); REPL toggles mutate this. */
  exec: ResolvedExecution;
}

async function executeTask(
  task: string,
  resolved: ReturnType<typeof createProvider>,
  workspace: string,
  session: SessionState,
  json = false,
  retrievalCfg?: { embeddings?: EmbeddingsConfig; retrieval: RetrievalConfig },
  stream = false,
  think = false,
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

  // Proactive context: semantic retrieval when embeddings are configured, else a
  // zero-setup keyword scan. Gated by the execution profile's auto-context flag.
  if (retrievalCfg) {
    const auto = await gatherContext(workspace, task, {
      enabled: session.exec.autoContext,
      embeddings: retrievalCfg.embeddings,
      retrieval: retrievalCfg.retrieval,
    });
    if (auto) {
      task = `${task}\n\n--- ${t("retrieval.injectedHeader")} ---\n\n${auto.block}`;
      if (!json) console.log(pc.dim(`↳ retrieve ${auto.count} (${auto.source})`));
    }
  }

  const spinner = new Spinner();
  const controller = new AbortController();
  const cancel = listenForCancel(controller); // ESC / Ctrl+C aborts the task
  // --json buffers a single final object; --json --stream emits NDJSON live.
  const emitLine = (e: unknown): void => {
    process.stdout.write(JSON.stringify(e) + "\n");
  };
  const streamer = json && stream ? createNdjsonStreamer(emitLine) : undefined;

  // Interactive ask_user over the stream: emit a choice-card prompt and await
  // the host's selection on stdin (the desktop bridge writes the reply line).
  const streamAsk = streamer ? createStreamAsk(emitLine) : undefined;
  let askInput: readline.Interface | undefined;
  if (streamAsk) {
    askInput = readline.createInterface({ input: process.stdin });
    askInput.on("line", (line) => streamAsk.handleLine(line));
  }

  // Emit session ID immediately so the caller can wire --resume for follow-ups.
  if (streamer) process.stdout.write(JSON.stringify({ type: "session_start", sessionId: session.id }) + "\n");
  const collector = json && !stream ? createJsonCollector() : undefined;

  // Cost estimation + budget enforcement (no-op when pricing is unknown).
  const pricing = await resolveModelPricing(resolved.config);
  let budgetHit = false;
  const baseEvents = streamer ? streamer.events : collector ? collector.events : renderEvents(spinner);
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
    network: session.network,
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

  // Load user-declared custom tools and hooks from .poly/ (if any), plus any
  // MCP servers (external tool servers) declared in .poly/mcp.json, plus skills
  // (project + global) the agent can pull in on demand.
  const [customTools, hooks, mcp, skills] = await Promise.all([
    loadCustomTools(workspace),
    loadHooks(workspace),
    loadMcpTools(workspace),
    loadSkills(workspace),
  ]);
  const extraTools = [
    ...customTools,
    ...mcp.tools,
    ...(skills.length > 0 ? [makeUseSkillTool(skills)] : []),
  ];
  if (!json && customTools.length > 0) {
    console.log(pc.dim(t("tools.customLoaded", { names: customTools.map((tl) => tl.spec.name).join(", ") })));
  }
  if (!json && mcp.servers.length > 0) {
    console.log(pc.dim(t("mcp.connected", { servers: mcp.servers.join(", "), n: mcp.tools.length })));
  }
  if (!json && skills.length > 0) {
    console.log(pc.dim(t("skills.loaded", { names: skills.map((s) => s.name).join(", ") })));
  }

  // Interactive choice prompt for the ask_user tool. When streaming, answers
  // come from the host over stdin (the choice card); on a TTY, from the clack
  // picker; plain --json stays headless (no one to answer).
  const ask = streamAsk
    ? streamAsk.ask
    : json
      ? undefined
      : async (req: AskRequest): Promise<string[] | null> => {
          spinner.stop();
          cancel.pause();
          const answer = await promptChoice(req);
          cancel.resume();
          return answer;
        };

  const runOnce = (taskText: string): Promise<RunResult> =>
    runAgent({
      task: taskText,
      workspace,
      agent: resolved,
      permissions,
      params: think ? { reasoning: true } : undefined,
      promptContext: {
        workspace,
        mode: session.mode,
        allow: session.allow,
        planFirst: session.exec.planFirst,
        skills: skills.map((s) => ({ name: s.name, description: s.description })),
        isCustomProvider: resolved.isCustomProvider,
      },
      history: session.history,
      maxSteps: session.maxSteps,
      compactThresholdTokens: compactionThreshold(),
      extraTools,
      hooks,
      // Closed-loop verification runs inside the loop at finish time, so it also
      // covers REPL/swarm — not just this command. Disabled in plan mode (no edits).
      verify: { enabled: session.exec.verify && session.mode !== "plan", maxFixes: session.exec.maxVerifyFixes },
      ask,
      signal: controller.signal,
      events,
    });

  if (!json) spinner.start(t("ui.thinking"));
  let result: RunResult;
  try {
    result = await runOnce(task);
    session.history = result.messages;
  } finally {
    spinner.stop();
    cancel.dispose();
    streamAsk?.dispose(); // resolve any pending choice card so we don't hang
    askInput?.close();
    await mcp.close(); // shut down any spawned MCP servers
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
    projectDir: process.cwd(),
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
  }, { workspace });

  if (streamer) {
    streamer.finalize(result);
    return;
  }
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
  // Tracks whether the current step already streamed text live, so onAssistantText
  // doesn't reprint it — it just closes the line.
  let streamed = false;
  return {
    onStep() {
      streamed = false;
      spinner.start(t("ui.thinking"));
    },
    onUsage(usage) {
      const total = usage.promptTokens + usage.completionTokens;
      if (total > 0) spinner.setSuffix(t("ui.tokensShort", { total: fmtTokens(total) }));
    },
    onAssistantDelta(chunk) {
      spinner.stop();
      process.stdout.write(pc.cyan(chunk));
      streamed = true;
    },
    onAssistantText(text) {
      spinner.stop();
      if (streamed) {
        process.stdout.write("\n"); // close the streamed line; already printed
        return;
      }
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
      // The agent gets the raw error for auto-correction, but a missing prerequisite
      // is really the user's to fix — surface an actionable hint in the terminal.
      if (!result.ok) {
        const hint = prerequisiteHint(result.output);
        if (hint) console.log(pc.yellow("      " + t(hint)));
      }
    },
    onReprompt(attempt) {
      spinner.stop();
      console.log(pc.yellow("  " + t("run.reprompt", { attempt })));
    },
    onCompaction(before, after) {
      spinner.stop();
      console.log(pc.dim("↯ " + t("compaction.done", { before: fmtTokens(before), after: fmtTokens(after) })));
    },
    onCorrection() {
      spinner.stop();
      console.log(pc.yellow("    ↻ " + t("run.autocorrect")));
    },
    onVerify(results) {
      spinner.stop();
      const failed = results.filter((r) => !r.ok);
      if (failed.length === 0) {
        console.log(pc.green("  ✓ " + t("verify.passed")));
      } else {
        console.log(pc.yellow("  ✗ " + t("verify.someFailed", { n: failed.length })));
      }
    },
    onSkill(name, scope) {
      spinner.stop();
      console.log(pc.magenta("  🎯 " + t("skills.activated", { name, scope })));
    },
  };
}

/** Map a known missing-prerequisite tool failure to an actionable, localized hint key. */
const PREREQ_HINTS: { re: RegExp; key: string }[] = [
  { re: /Python not found/, key: "run.hint.pythonMissing" },
];
export function prerequisiteHint(output: string): string | null {
  return PREREQ_HINTS.find((h) => h.re.test(output))?.key ?? null;
}

/** Render an agent question as an interactive single/multi-choice prompt. */
async function promptChoice(req: AskRequest): Promise<string[] | null> {
  const options = req.options.map((o) => ({ value: o, label: o }));
  if (req.multi) {
    const sel = await p.multiselect({ message: req.question, options, required: false });
    if (p.isCancel(sel)) return null;
    return sel as string[];
  }
  const sel = await p.select({ message: req.question, options });
  if (p.isCancel(sel)) return null;
  return [sel as string];
}
