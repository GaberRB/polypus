import { runAgent, type AgentEvents } from "./loop.js";
import { commitWorktree, type Worktree } from "../git/worktree.js";
import { PermissionEngine } from "../permissions/modes.js";
import type { ResolvedAgent } from "../providers/registry.js";

export interface Subtask {
  id: string;
  title: string;
  brief: string;
}

export interface WorkerOutcome {
  subtask: Subtask;
  agentName: string;
  branch: string;
  finished: boolean;
  summary?: string;
  committed: boolean;
  steps: number;
}

/**
 * Run one subtask to completion inside an isolated worktree. Workers run in
 * `bypass` mode because the worktree is throwaway and merges are reviewed later.
 */
export async function runWorker(
  subtask: Subtask,
  agent: ResolvedAgent,
  wt: Worktree,
  allow: string[],
  deny: string[],
  events?: AgentEvents,
  signal?: AbortSignal,
): Promise<WorkerOutcome> {
  const permissions = new PermissionEngine({
    mode: "bypass",
    policy: { workspace: wt.path, allow, deny },
    allowedCommands: [],
  });

  const result = await runAgent({
    task: subtask.brief,
    workspace: wt.path,
    agent,
    permissions,
    promptContext: { workspace: wt.path, mode: "bypass", allow, briefing: subtask.brief },
    events,
    signal,
  });

  // Don't commit a worker that was cancelled/timed out mid-step — its worktree
  // may hold half-applied changes we don't want to merge.
  const committed =
    result.reason === "cancelled"
      ? false
      : await commitWorktree(wt, `polypus(${subtask.id}): ${subtask.title}`);

  return {
    subtask,
    agentName: agent.config.name,
    branch: wt.branch,
    finished: result.finished,
    summary: result.summary,
    committed,
    steps: result.steps,
  };
}
