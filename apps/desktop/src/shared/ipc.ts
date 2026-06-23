/**
 * Shared IPC contract between the Electron main process and the renderer.
 * v1 of the bridge (#114) reuses Polypus' headless JSON commands — the main
 * process spawns the CLI and returns parsed JSON. Live token streaming and the
 * remaining surfaces (agents, sessions, usage, retrieval) come once `src/core`
 * is consumed as a library; see #112.
 */

/** Permission mode for a run (mirrors src/core PermissionMode). */
export type Mode = "plan" | "review" | "bypass";

/** Channel names (kept here so main/preload can't drift). */
export const IPC = {
  estimate: "polypus:estimate",
  review: "polypus:review",
  run: "polypus:run",
  index: "polypus:index",
  retrieve: "polypus:retrieve",
  recentList: "polypus:recent:list",
  recentAdd: "polypus:recent:add",
  sessionsList: "polypus:sessions:list",
  runStart: "polypus:run:start",
  runEvent: "polypus:run:event",
} as const;

/**
 * A streamed run event (from `run --json --stream`), plus the bridge's own
 * `end`/`error` terminal events. Mirrors src/cli StreamEvent.
 */
export interface StreamEvent {
  type:
    | "step"
    | "assistant_delta"
    | "assistant"
    | "tool_call"
    | "tool_result"
    | "correction"
    | "reprompt"
    | "compaction"
    | "usage"
    | "result"
    | "end"
    | "error";
  [key: string]: unknown;
}

/** A recently opened project folder (mirrors src/core recent-projects). */
export interface RecentProject {
  path: string;
  lastOpenedAt: string;
}

/** A saved session summary (mirrors src/core SessionSummary). */
export interface SessionSummary {
  id: string;
  updatedAt: string;
  title: string;
  agentName: string;
  mode: string;
  messageCount: number;
}

/** Every bridge call resolves to a Result so the renderer never sees a throw. */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** Shape of `polypus estimate --json`. */
export interface EstimateResult {
  estimate?: {
    complexity?: string;
    estimatedSteps?: number;
    estimatedTokens?: number;
    costLabel?: string;
    rationale?: string;
    risks?: string;
  };
}

/** Shape of `polypus run --json`. */
export interface RunResult {
  result?: {
    reason: string;
    steps: number;
    filesChanged?: string[];
  };
}

/** A single review finding (mirrors src/core/agent/review.ts). */
export interface ReviewFinding {
  file?: string;
  issue: string;
}

/** Shape of `polypus review --json`. */
export interface ReviewResult {
  blocking: ReviewFinding[];
  warnings: ReviewFinding[];
  suggestions: ReviewFinding[];
}
