import pc from "picocolors";
import { loadConfig } from "../../core/config/store.js";
import { createProvider, type ResolvedAgent } from "../../core/providers/registry.js";
import { runSwarm, type SwarmEvents } from "../../core/agent/orchestrator.js";
import { t } from "../../core/i18n/index.js";

export interface SwarmCliOptions {
  agents?: string;
  maxSubtasks?: string;
}

/** `polypus swarm <task>` — decompose and run a task across agents in parallel worktrees. */
export async function swarm(task: string, opts: SwarmCliOptions): Promise<void> {
  const config = await loadConfig();

  const selected = opts.agents
    ? opts.agents.split(",").map((s) => s.trim()).filter(Boolean)
    : config.agents.map((a) => a.name);
  if (selected.length === 0) {
    throw new Error(t("swarm.noAgents"));
  }

  const resolved: ResolvedAgent[] = selected.map((name) => {
    const a = config.agents.find((x) => x.name === name);
    if (!a) throw new Error(t("agent.notFound", { name }));
    return createProvider(a);
  });

  console.log(
    pc.dim(t("swarm.status", { agents: resolved.map((a) => a.config.name).join(", "), workspace: process.cwd() })),
  );
  console.log(pc.yellow(t("swarm.bypassNote") + "\n"));

  const result = await runSwarm({
    task,
    workspace: process.cwd(),
    agents: resolved,
    allow: config.permissions.allow,
    deny: config.permissions.deny,
    maxSubtasks: opts.maxSubtasks ? Number(opts.maxSubtasks) : undefined,
    events: renderSwarmEvents(),
  });

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

function renderSwarmEvents(): SwarmEvents {
  return {
    onDecomposed(subtasks) {
      console.log(pc.bold(t("swarm.decomposed", { n: subtasks.length })));
      for (const s of subtasks) console.log(pc.dim(`  ${s.id}: ${s.title}`));
      console.log("");
    },
    onWorkerStart(subtask, agentName) {
      console.log(pc.cyan(t("swarm.workerStart", { id: subtask.id, agent: agentName })));
    },
    onWorkerDone(o) {
      const head = o.finished
        ? pc.green(t("swarm.workerDone", { id: o.subtask.id }))
        : pc.yellow(t("swarm.workerStopped", { id: o.subtask.id }));
      const changes = o.committed ? t("swarm.changesCommitted") : t("swarm.noChanges");
      console.log(head + pc.dim(t("swarm.workerMeta", { steps: o.steps, changes })));
    },
    onMerge(m) {
      console.log(m.ok ? pc.dim(t("swarm.merged", { branch: m.branch })) : pc.red(t("swarm.mergeConflict", { branch: m.branch })));
    },
  };
}
