import { runAgent, type AgentEvents, type Usage, type VerifyOptions } from "./loop.js";
import { commitWorktree, type Worktree } from "../git/worktree.js";
import { PermissionEngine } from "../permissions/modes.js";
import type { ResolvedAgent } from "../providers/registry.js";
import { loadSkills, makeUseSkillTool } from "../skills/index.js";

export interface Subtask {
  id: string;
  title: string;
  brief: string;
}

export interface WorkerOutcome {
  subtask: Subtask;
  agentName: string;
  /** Provider + model that ran this worker, for usage accounting. */
  provider: string;
  model: string;
  branch: string;
  finished: boolean;
  summary?: string;
  committed: boolean;
  steps: number;
  /** Closed-loop verification result (undefined when verification was off/N-A). */
  verified?: boolean;
  /** Token usage for this worker (zeroed if it never ran). */
  usage: Usage;
}

/** Per-worker execution scaffolding, mirrored from the swarm's config. */
export interface WorkerExecution {
  verify?: VerifyOptions;
  planFirst?: boolean;
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
  execution?: WorkerExecution,
): Promise<WorkerOutcome> {
  const permissions = new PermissionEngine({
    mode: "bypass",
    policy: { workspace: wt.path, allow, deny },
    allowedCommands: [],
  });

  // Global skills (~/.polypus/skills) are available even in throwaway worktrees,
  // which don't carry the gitignored project `.poly/`.
  const skills = await loadSkills(wt.path);

  const result = await runAgent({
    task: subtask.brief,
    workspace: wt.path,
    agent,
    permissions,
    promptContext: {
      workspace: wt.path,
      mode: "bypass",
      allow,
      briefing: subtask.brief,
      planFirst: execution?.planFirst,
      skills: skills.map((s) => ({ name: s.name, description: s.description })),
    },
    verify: execution?.verify,
    extraTools: skills.length > 0 ? [makeUseSkillTool(skills)] : undefined,
    events,
    signal,
  });

  // Don't commit a worker that was cancelled/timed out mid-step — its worktree
  // may hold half-applied changes we don't want to merge. Code that failed
  // verification is still committed (so the branch survives for inspection) but
  // flagged unverified so the orchestrator won't merge it.
  const committed =
    result.reason === "cancelled"
      ? false
      : await commitWorktree(wt, `polypus(${subtask.id}): ${subtask.title}`);

  return {
    subtask,
    agentName: agent.config.name,
    provider: agent.config.provider,
    model: agent.config.model,
    branch: wt.branch,
    finished: result.finished,
    summary: result.summary,
    committed,
    steps: result.steps,
    verified: result.verified,
    usage: result.usage,
  };
}
