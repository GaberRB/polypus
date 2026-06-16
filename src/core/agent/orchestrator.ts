import type { ResolvedAgent } from "../providers/registry.js";
import {
  createWorktree,
  ensureRepo,
  mergeWorktreeBranch,
  removeWorktree,
  type MergeResult,
  type Worktree,
} from "../git/worktree.js";
import { runWorker, type Subtask, type WorkerOutcome } from "./worker.js";
import type { AgentEvents } from "./loop.js";

export interface SwarmOptions {
  task: string;
  workspace: string;
  agents: ResolvedAgent[];
  allow: string[];
  deny: string[];
  maxSubtasks?: number;
  events?: SwarmEvents;
}

export interface SwarmEvents {
  onDecomposed?(subtasks: Subtask[]): void;
  onWorkerStart?(subtask: Subtask, agentName: string): void;
  onWorkerDone?(outcome: WorkerOutcome): void;
  onMerge?(result: MergeResult): void;
  workerEvents?(subtask: Subtask): AgentEvents | undefined;
}

export interface SwarmResult {
  subtasks: Subtask[];
  outcomes: WorkerOutcome[];
  merges: MergeResult[];
}

/**
 * Decompose a task with the lead agent, run each subtask in a parallel worker
 * (each in its own git worktree), then merge the branches sequentially.
 */
export async function runSwarm(opts: SwarmOptions): Promise<SwarmResult> {
  const lead = opts.agents[0];
  if (!lead) throw new Error("Swarm requires at least one agent.");

  const maxSubtasks = opts.maxSubtasks ?? Math.max(opts.agents.length, 2);
  const git = await ensureRepo(opts.workspace);

  const subtasks = await decompose(lead, opts.task, maxSubtasks);
  opts.events?.onDecomposed?.(subtasks);

  // Create worktrees sequentially (concurrent `git worktree add` can hit index
  // locks), then run the workers in parallel (round-robin across agents).
  const worktrees: Worktree[] = [];
  for (const subtask of subtasks) {
    worktrees.push(await createWorktree(git, subtask.id));
  }

  const outcomes: WorkerOutcome[] = await Promise.all(
    subtasks.map(async (subtask, i) => {
      const agent = opts.agents[i % opts.agents.length]!;
      const wt = worktrees[i]!;
      opts.events?.onWorkerStart?.(subtask, agent.config.name);
      const outcome = await runWorker(
        subtask,
        agent,
        wt,
        opts.allow,
        opts.deny,
        opts.events?.workerEvents?.(subtask),
      );
      opts.events?.onWorkerDone?.(outcome);
      return outcome;
    }),
  );

  // Merge sequentially so conflicts are attributed to a specific branch.
  const merges: MergeResult[] = [];
  for (const outcome of outcomes) {
    if (!outcome.committed) continue;
    const merge = await mergeWorktreeBranch(git, outcome.branch);
    merges.push(merge);
    opts.events?.onMerge?.(merge);
  }

  // Clean up worktrees and branches that merged cleanly; keep conflicted branches for inspection.
  const conflicted = new Set(merges.filter((m) => !m.ok).map((m) => m.branch));
  for (const wt of worktrees) {
    if (conflicted.has(wt.branch)) {
      await git.raw(["worktree", "remove", wt.path, "--force"]).catch(() => undefined);
    } else {
      await removeWorktree(git, wt);
    }
  }

  return { subtasks, outcomes, merges };
}

const DECOMPOSE_SYSTEM = [
  "You are a tech lead splitting a coding task into independent subtasks that can be done in parallel.",
  "Return ONLY a JSON array. Each item: {\"title\": string, \"brief\": string}.",
  "Make subtasks touch DIFFERENT files/areas to minimize merge conflicts.",
  "Keep the list small (prefer 2-4 items). Each brief must be self-contained and actionable.",
].join("\n");

/** Ask the lead agent to split the task into subtasks; fall back to a single subtask. */
async function decompose(
  lead: ResolvedAgent,
  task: string,
  maxSubtasks: number,
): Promise<Subtask[]> {
  try {
    const res = await lead.provider.chat({
      messages: [
        { role: "system", content: DECOMPOSE_SYSTEM },
        { role: "user", content: `Task:\n${task}\n\nReturn at most ${maxSubtasks} subtasks as a JSON array.` },
      ],
      params: { temperature: 0 },
    });
    const parsed = extractJsonArray(res.content);
    if (parsed && parsed.length > 0) {
      return parsed.slice(0, maxSubtasks).map((item, i) => ({
        id: `t${i + 1}`,
        title: String(item.title ?? `subtask ${i + 1}`),
        brief: String(item.brief ?? item.title ?? task),
      }));
    }
  } catch {
    /* fall through to single-subtask mode */
  }
  return [{ id: "t1", title: "task", brief: task }];
}

function extractJsonArray(text: string): Array<{ title?: string; brief?: string }> | null {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
