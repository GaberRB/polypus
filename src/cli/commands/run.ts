import pc from "picocolors";
import * as p from "@clack/prompts";
import type { PermissionMode } from "../../core/config/schema.js";
import { loadConfig, resolveAgent } from "../../core/config/store.js";
import { createProvider } from "../../core/providers/registry.js";
import { PermissionEngine, type ConfirmRequest } from "../../core/permissions/modes.js";
import { runAgent, type AgentEvents } from "../../core/agent/loop.js";
import type { Message } from "../../core/providers/types.js";
import { startRepl } from "../../ui/repl.js";

export interface RunOptions {
  agent?: string;
  mode?: string;
  maxSteps?: string;
}

/** `polypus run [task]` — one-shot if a task is given, otherwise an interactive REPL. */
export async function run(task: string | undefined, opts: RunOptions): Promise<void> {
  const config = await loadConfig();
  const agentConfig = resolveAgent(config, opts.agent);
  const resolved = createProvider(agentConfig);
  const workspace = process.cwd();

  const session: SessionState = {
    mode: (opts.mode as PermissionMode) ?? config.permissions.mode,
    allow: config.permissions.allow,
    deny: config.permissions.deny,
    allowedCommands: config.permissions.allowedCommands,
    maxSteps: opts.maxSteps ? Number(opts.maxSteps) : undefined,
    history: [],
  };

  console.log(
    pc.dim(
      `agent=${resolved.config.name} provider=${resolved.config.provider} model=${resolved.config.model} ` +
        `tool-mode=${resolved.toolMode} permission-mode=${session.mode}`,
    ),
  );

  if (task) {
    await executeTask(task, resolved, workspace, session);
    return;
  }
  await startRepl((t) => executeTask(t, resolved, workspace, session), session);
}

export interface SessionState {
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
  const permissions = new PermissionEngine({
    mode: session.mode,
    policy: { workspace, allow: session.allow, deny: session.deny },
    allowedCommands: session.allowedCommands,
    confirm: confirmAction,
  });

  const result = await runAgent({
    task,
    workspace,
    agent: resolved,
    permissions,
    promptContext: { workspace, mode: session.mode, allow: session.allow },
    history: session.history,
    maxSteps: session.maxSteps,
    events: renderEvents(),
  });

  session.history = result.messages;

  if (result.finished) {
    console.log(pc.green(`\n✓ Done (${result.steps} steps).`) + (result.summary ? ` ${result.summary}` : ""));
  } else {
    console.log(
      pc.yellow(`\n⚠ Stopped after ${result.steps} steps without a finish signal. You can continue with another instruction.`),
    );
  }
}

async function confirmAction(req: ConfirmRequest): Promise<boolean> {
  if (req.preview) console.log(pc.dim(req.preview));
  const answer = await p.confirm({ message: `Allow ${req.summary}?` });
  if (p.isCancel(answer)) return false;
  return answer === true;
}

function renderEvents(): AgentEvents {
  return {
    onAssistantText(text) {
      if (text.trim()) console.log(pc.cyan(text.trim()));
    },
    onToolCall(call) {
      const arg = call.name === "run_command" ? call.arguments.command : call.arguments.path;
      console.log(pc.dim(`  → ${call.name}${arg ? ` ${String(arg)}` : ""}`));
    },
    onToolResult(_call, result) {
      const head = result.output.split("\n")[0] ?? "";
      console.log((result.ok ? pc.green("    ✓ ") : pc.red("    ✗ ")) + pc.dim(head.slice(0, 120)));
    },
    onReprompt(attempt) {
      console.log(pc.yellow(`  ↻ no tool call — reinforcing instructions (attempt ${attempt})`));
    },
  };
}
