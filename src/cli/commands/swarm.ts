import pc from "picocolors";
import { loadConfig } from "../../core/config/store.js";
import { createProvider, type ResolvedAgent } from "../../core/providers/registry.js";
import { runSwarm } from "../../core/agent/orchestrator.js";
import type { WorkerOutcome } from "../../core/agent/worker.js";
import { recommendConcurrency, idleTimeoutMs, overallTimeoutMs } from "../../core/agent/concurrency.js";
import { recordUsage, resolveModelPricing, estimateCost, type ModelPricing } from "../../core/agent/usage.js";
import { SwarmView, describeToolCall } from "../../ui/swarm-view.js";
import { listenForCancel } from "../../ui/cancel.js";
import { t } from "../../core/i18n/index.js";
import { resolveExecution, type PolypusConfig } from "../../core/config/schema.js";

export interface SwarmCliOptions {
  agents?: string;
  maxSubtasks?: string;
  workers?: string;
  fast?: boolean;
  quality?: boolean;
  verify?: boolean;
}

/** Minimum number of configured agents for swarm mode to be worthwhile. */
export const MIN_SWARM_AGENTS = 1;

/** Swarm can run with one agent, which will fan out subtasks to parallel workers. */
export function canSwarm(agentCount: number): boolean {
  return agentCount >= MIN_SWARM_AGENTS;
}

export interface SwarmSessionOptions {
  /** Subset of agent names to use; defaults to all configured agents. */
  agents?: string[];
  maxSubtasks?: number;
  /**
   * Fan-out: number of parallel workers. Sets BOTH the subtask count and the
   * concurrency, so a single agent can run N subtasks at once (overrides the
   * per-endpoint concurrency cap). `--max-subtasks` still wins for the count.
   */
  workers?: number;
  /** Workspace to run in; defaults to the current working directory. */
  workspace?: string;
  /** Execution profile override (from --fast/--quality). */
  profile?: "quality" | "fast";
  /** Verification override (from --verify/--no-verify). */
  verify?: boolean;
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
  // Gate: swarm requires at least one agent.
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

  // Resolve quality-vs-fast scaffolding for every worker.
  const exec = resolveExecution(config.execution, { profile: opts.profile, verify: opts.verify });

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
      maxSubtasks: opts.maxSubtasks ?? opts.workers,
      // --workers overrides the per-endpoint cap so 1 agent fans out to N parallel workers.
      concurrency: opts.workers ?? recommendConcurrency(resolved),
      idleTimeoutMs: idleTimeoutMs(),
      execution: { verify: { enabled: exec.verify, maxFixes: exec.maxVerifyFixes }, planFirst: exec.planFirst },
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

  // Persist per-worker token/cost analytics (best-effort). Pricing is resolved
  // once per agent; only OpenRouter advertises prices, others record cost 0.
  await recordSwarmUsage(result.outcomes, resolved, workspace);

  // Final report.
  console.log(pc.bold("\n" + t("swarm.summary")));
  for (const o of result.outcomes) {
    const status = o.finished ? pc.green(t("swarm.statusDone")) : pc.yellow(t("swarm.statusIncomplete"));
    const committed = o.committed ? "" : pc.dim(` (${t("swarm.noChanges")})`);
    // A worker whose checks never passed is kept on its branch but not merged.
    const unverified = o.verified === false ? pc.red(` (${t("swarm.unverified")})`) : "";
    console.log(`  ${pc.bold(o.subtask.id)} [${o.agentName}] ${status}${committed}${unverified} — ${o.subtask.title}`);
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

/**
 * Append one usage record per worker outcome to the global + project logs.
 * Pricing is resolved once per agent (cached); failures are swallowed since
 * analytics are best-effort and must not break the swarm.
 */
async function recordSwarmUsage(
  outcomes: WorkerOutcome[],
  resolved: ResolvedAgent[],
  workspace: string,
): Promise<void> {
  const configByName = new Map(resolved.map((a) => [a.config.name, a.config]));
  const pricingByAgent = new Map<string, Promise<ModelPricing | undefined>>();
  await Promise.all(
    outcomes.map(async (o) => {
      const cfg = configByName.get(o.agentName);
      let costUsd = 0;
      if (cfg) {
        let pricing = pricingByAgent.get(o.agentName);
        if (!pricing) {
          pricing = resolveModelPricing(cfg);
          pricingByAgent.set(o.agentName, pricing);
        }
        const p = await pricing;
        if (p) costUsd = estimateCost(o.usage, p);
      }
      await recordUsage(
        {
          ts: new Date().toISOString(),
          agent: o.agentName,
          provider: o.provider,
          model: o.model,
          promptTokens: o.usage.promptTokens,
          completionTokens: o.usage.completionTokens,
          costUsd,
        },
        { workspace },
      );
    }),
  );
}

/** `polypus swarm <task>` — load config, parse CLI options and run the session. */
export async function swarm(task: string, opts: SwarmCliOptions): Promise<void> {
  const config = await loadConfig();
  await runSwarmSession(task, config, {
    agents: opts.agents
      ? opts.agents.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined,
    maxSubtasks: opts.maxSubtasks ? Number(opts.maxSubtasks) : undefined,
    workers: opts.workers ? Number(opts.workers) : undefined,
    profile: opts.fast ? "fast" : opts.quality ? "quality" : undefined,
    verify: opts.verify,
  });
}
