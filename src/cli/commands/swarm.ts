import pc from "picocolors";
import { loadConfig } from "../../core/config/store.js";
import { createProvider, type ResolvedAgent } from "../../core/providers/registry.js";
import { runSwarm } from "../../core/agent/orchestrator.js";
import { recommendConcurrency, idleTimeoutMs, overallTimeoutMs } from "../../core/agent/concurrency.js";
import { SwarmView, describeToolCall } from "../../ui/swarm-view.js";
import { listenForCancel } from "../../ui/cancel.js";
import { t } from "../../core/i18n/index.js";
import type { PolypusConfig } from "../../core/config/schema.js";

export interface SwarmCliOptions {
  agents?: string;
  maxSubtasks?: string;
}

/** Minimum number of configured agents for swarm mode to be worthwhile. */
export const MIN_SWARM_AGENTS = 3;

/** Swarm only pays off when there are several agents to spread subtasks across. */
export function canSwarm(agentCount: number): boolean {
  return agentCount >= MIN_SWARM_AGENTS;
}

export interface SwarmSessionOptions {
  /** Subset of agent names to use; defaults to all configured agents. */
  agents?: string[];
  maxSubtasks?: number;
  /** Workspace to run in; defaults to the current working directory. */
  workspace?: string;
}

/**
 * Decompose and run a task across agents in parallel worktrees, rendering the
 * live dashboard and a final report. Shared by the `polypus swarm` CLI command
 * and the REPL `/swarm` command. Enforces the 3+ agent gate.
 */
export async function runSwarmSession(
  task: string,
  config: PolypusConfig,
  opts: SwarmSessionOptions = {},
): Promise<void> {
  // Gate: swarm is for 3+ agents; with fewer it degenerates into a single-agent run.
  if (!canSwarm(config.agents.length)) {
    throw new Error(t("swarm.needsAgents", { min: MIN_SWARM_AGENTS, have: config.agents.length }));
  }

  const workspace = opts.workspace ?? process.cwd();
  const selected = opts.agents?.length ? opts.agents : config.agents.map((a) => a.name);
  if (selected.length === 0) {
    throw new Error(t("swarm.noAgents"));
  }

  const resolved: ResolvedAgent[] = selected.map((name) => {
    const a = config.agents.find((x) => x.name === name);
    if (!a) throw new Error(t("agent.notFound", { name }));
    return createProvider(a);
  });

  console.log(
    pc.dim(t("swarm.status", { agents: resolved.map((a) => a.config.name).join(", "), workspace })),
  );
  console.log(pc.yellow(t("swarm.bypassNote") + "\n"));

  // ESC / Ctrl+C cancels: committed workers still merge, the rest are aborted.
  const controller = new AbortController();
  const cancel = listenForCancel(controller);
  controller.signal.addEventListener("abort", () => console.log(pc.dim("\n" + t("swarm.cancelling"))), {
    once: true,
  });

  const view = new SwarmView(resolved[0]!.config.name);
  view.start();
  let result;
  const sessionTimeout = setTimeout(() => {
    controller.abort();
    console.log(pc.red(t("swarm.timeout")));
  }, overallTimeoutMs());
  try {
    result = await runSwarm({
      task,
      workspace,
      agents: resolved,
      allow: config.permissions.allow,
      deny: config.permissions.deny,
      maxSubtasks: opts.maxSubtasks,
      concurrency: recommendConcurrency(resolved),
      idleTimeoutMs: idleTimeoutMs(),
      signal: controller.signal,
      events: {
        onDecomposed: (subtasks) => view.setSubtasks(subtasks),
        onWorkerStart: (subtask, agentName) => view.workerStart(subtask.id, agentName),
        onWorkerDone: (outcome) => view.workerDone(outcome),
        onMerge: (merge) => view.merge(merge),
        workerEvents: (subtask) => ({
          onToolCall: (call) => view.workerAction(subtask.id, describeToolCall(call)),
          onStep: (step) => view.workerStep(subtask.id, step),
        }),
      },
    });
  } finally {
    clearTimeout(sessionTimeout);
    view.stop();
    cancel.dispose();
  }
  console.log("");

  // Final report.
  console.log(pc.bold("\n" + t("swarm.summary")));
  for (const o of result.outcomes) {
    const status = o.finished ? pc.green(t("swarm.statusDone")) : pc.yellow(t("swarm.statusIncomplete"));
    const committed = o.committed ? "" : pc.dim(` (${t("swarm.noChanges")})`);
    console.log(`  ${pc.bold(o.subtask.id)} [${o.agentName}] ${status}${committed} — ${o.subtask.title}`);
  }
  const conflicts = result.merges.filter((m) => !m.ok);
  if (conflicts.length > 0) {
    console.log(pc.red("\n" + t("swarm.conflictsHeader", { n: conflicts.length })));
    for (const m of conflicts) {
      console.log(pc.red(`  ${m.branch}: ${m.conflicts.join(", ")}`));
    }
  } else {
    console.log(pc.green("\n" + t("swarm.allMerged")));
  }
}

/** `polypus swarm <task>` — load config, parse CLI options and run the session. */
export async function swarm(task: string, opts: SwarmCliOptions): Promise<void> {
  const config = await loadConfig();
  await runSwarmSession(task, config, {
    agents: opts.agents
      ? opts.agents.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined,
    maxSubtasks: opts.maxSubtasks ? Number(opts.maxSubtasks) : undefined,
  });
}
