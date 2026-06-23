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
} as const;

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
