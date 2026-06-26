import type { ResolvedAgent } from "../providers/registry.js";
import {
  createWorktree,
  ensureRepo,
  mergeWorktreeBranch,
  removeWorktree,
  type MergeResult,
  type Worktree,
} from "../git/worktree.js";
import { runWorker, type Subtask, type WorkerExecution, type WorkerOutcome } from "./worker.js";
import type { AgentEvents } from "./loop.js";

export interface SwarmOptions {
  task: string;
  workspace: string;
  agents: ResolvedAgent[];
  allow: string[];
  deny: string[];
  maxSubtasks?: number;
  /** Max workers running at once. Defaults to the number of agents. */
  concurrency?: number;
  /** Abort a worker that makes no progress (no step) for this long. 0 disables. */
  idleTimeoutMs?: number;
  /** Execution scaffolding applied to every worker (verification, plan-first). */
  execution?: WorkerExecution;
  /** Cancel the whole swarm (e.g. user pressed ESC). */
  signal?: AbortSignal;
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
 * (each in its own git worktree, bounded by `concurrency`), then merge the
 * branches sequentially. Cancellable via `signal`; a worker that stalls past
 * `idleTimeoutMs` is aborted without sinking the run. Workers never reject —
 * a failed/aborted worker yields an unfinished outcome — so the committed ones
 * still merge, even after cancellation.
 */
export async function runSwarm(opts: SwarmOptions): Promise<SwarmResult> {
  const lead = opts.agents[0];
  if (!lead) throw new Error("Swarm requires at least one agent.");

  const maxSubtasks = opts.maxSubtasks ?? Math.max(opts.agents.length, 2);
  const concurrency = Math.max(1, opts.concurrency ?? opts.agents.length);
  const idleTimeoutMs = opts.idleTimeoutMs ?? 0;
  const git = await ensureRepo(opts.workspace);

  const subtasks = await decompose(lead, opts.task, maxSubtasks, opts.signal);
  opts.events?.onDecomposed?.(subtasks);

  // Create worktrees sequentially (concurrent `git worktree add` can hit index
  // locks), then run the workers through a bounded pool.
  const worktrees: Worktree[] = [];
  for (const subtask of subtasks) {
    worktrees.push(await createWorktree(git, subtask.id));
  }

  const runOne = (subtask: Subtask, i: number): Promise<WorkerOutcome> =>
    guardedWorker(subtask, opts.agents[i % opts.agents.length]!, worktrees[i]!, {
      allow: opts.allow,
      deny: opts.deny,
      idleTimeoutMs,
      execution: opts.execution,
      signal: opts.signal,
      events: opts.events,
    });
  const outcomes = await runPool(subtasks, concurrency, runOne);

  // Merge sequentially so conflicts are attributed to a specific branch. Runs
  // even after cancellation, so committed workers aren't thrown away. Code that
  // failed verification (verified === false) is kept on its branch but NOT
  // merged, so a broken subtask never lands on the main worktree.
  const merges: MergeResult[] = [];
  const unverified = new Set<string>();
  for (const outcome of outcomes) {
    if (!outcome.committed) continue;
    if (outcome.verified === false) {
      unverified.add(outcome.branch);
      continue;
    }
    const merge = await mergeWorktreeBranch(git, outcome.branch);
    merges.push(merge);
    opts.events?.onMerge?.(merge);
  }

  // Keep worktrees for branches that conflicted OR failed verification (for
  // inspection); clean up the rest.
  const conflicted = new Set(merges.filter((m) => !m.ok).map((m) => m.branch));
  for (const wt of worktrees) {
    if (conflicted.has(wt.branch) || unverified.has(wt.branch)) {
      await git.raw(["worktree", "remove", wt.path, "--force"]).catch(() => undefined);
    } else {
      await removeWorktree(git, wt);
    }
  }

  return { subtasks, outcomes, merges };
}

interface GuardOptions {
  allow: string[];
  deny: string[];
  idleTimeoutMs: number;
  execution?: WorkerExecution;
  signal?: AbortSignal;
  events?: SwarmEvents;
}

/**
 * Run a single worker with its own abort controller, wired to the global signal
 * and an idle-timeout watchdog (reset on each step). Never rejects: any error or
 * abort yields an unfinished outcome.
 */
async function guardedWorker(
  subtask: Subtask,
  agent: ResolvedAgent,
  wt: Worktree,
  opts: GuardOptions,
): Promise<WorkerOutcome> {
  const ac = new AbortController();
  const onAbort = (): void => ac.abort();
  if (opts.signal) {
    if (opts.signal.aborted) ac.abort();
    else opts.signal.addEventListener("abort", onAbort, { once: true });
  }

  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const resetIdle = (): void => {
    if (opts.idleTimeoutMs <= 0) return;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => ac.abort(), opts.idleTimeoutMs);
    idleTimer.unref?.();
  };

  const base = opts.events?.workerEvents?.(subtask);
  const events: AgentEvents = {
    ...base,
    onStep: (n) => {
      resetIdle();
      base?.onStep?.(n);
    },
  };

  opts.events?.onWorkerStart?.(subtask, agent.config.name);
  resetIdle();

  let outcome: WorkerOutcome;
  try {
    outcome = await runWorker(subtask, agent, wt, opts.allow, opts.deny, events, ac.signal, opts.execution);
  } catch {
    outcome = {
      subtask,
      agentName: agent.config.name,
      provider: agent.config.provider,
      model: agent.config.model,
      branch: wt.branch,
      finished: false,
      committed: false,
      steps: 0,
      usage: { promptTokens: 0, completionTokens: 0 },
    };
  } finally {
    if (idleTimer) clearTimeout(idleTimer);
    opts.signal?.removeEventListener("abort", onAbort);
  }
  opts.events?.onWorkerDone?.(outcome);
  return outcome;
}

/** Run `fn` over `items` with at most `limit` in flight; preserves result order. */
async function runPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!, i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
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
  signal?: AbortSignal,
): Promise<Subtask[]> {
  try {
    const res = await lead.provider.chat({
      messages: [
        { role: "system", content: DECOMPOSE_SYSTEM },
        { role: "user", content: `Task:\n${task}\n\nReturn at most ${maxSubtasks} subtasks as a JSON array.` },
      ],
      params: { temperature: 0 },
      signal,
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
