import pc from "picocolors";
import { loadConfig } from "../../core/config/store.js";
import { createProvider, type ResolvedAgent } from "../../core/providers/registry.js";
import { runSwarm, type SwarmEvents } from "../../core/agent/orchestrator.js";

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
    throw new Error("No agents configured. Run `polypus setup` or `polypus add-agent` first.");
  }

  const resolved: ResolvedAgent[] = selected.map((name) => {
    const a = config.agents.find((x) => x.name === name);
    if (!a) throw new Error(`No agent named "${name}".`);
    return createProvider(a);
  });

  console.log(
    pc.dim(`swarm agents=[${resolved.map((a) => a.config.name).join(", ")}] workspace=${process.cwd()}`),
  );
  console.log(pc.yellow("Workers run in bypass mode inside isolated git worktrees; branches are merged at the end.\n"));

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
  console.log(pc.bold("\nSummary:"));
  for (const o of result.outcomes) {
    const status = o.finished ? pc.green("done") : pc.yellow("incomplete");
    const committed = o.committed ? "" : pc.dim(" (no changes)");
    console.log(`  ${pc.bold(o.subtask.id)} [${o.agentName}] ${status}${committed} — ${o.subtask.title}`);
  }
  const conflicts = result.merges.filter((m) => !m.ok);
  if (conflicts.length > 0) {
    console.log(pc.red(`\n⚠ ${conflicts.length} branch(es) had merge conflicts (kept for inspection):`));
    for (const m of conflicts) {
      console.log(pc.red(`  ${m.branch}: ${m.conflicts.join(", ")}`));
    }
  } else {
    console.log(pc.green("\n✓ All committed branches merged cleanly."));
  }
}

function renderSwarmEvents(): SwarmEvents {
  return {
    onDecomposed(subtasks) {
      console.log(pc.bold(`Decomposed into ${subtasks.length} subtask(s):`));
      for (const s of subtasks) console.log(pc.dim(`  ${s.id}: ${s.title}`));
      console.log("");
    },
    onWorkerStart(subtask, agentName) {
      console.log(pc.cyan(`▶ ${subtask.id} started by ${agentName}`));
    },
    onWorkerDone(o) {
      console.log(
        (o.finished ? pc.green(`✓ ${o.subtask.id} done`) : pc.yellow(`… ${o.subtask.id} stopped`)) +
          pc.dim(` (${o.steps} steps, ${o.committed ? "changes committed" : "no changes"})`),
      );
    },
    onMerge(m) {
      console.log(m.ok ? pc.dim(`  merged ${m.branch}`) : pc.red(`  conflict merging ${m.branch}`));
    },
  };
}
