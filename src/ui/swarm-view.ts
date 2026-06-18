import type { ToolCall } from "../core/providers/types.js";
import type { Subtask, WorkerOutcome } from "../core/agent/worker.js";
import type { MergeResult } from "../core/git/worktree.js";
import { t } from "../core/i18n/index.js";

const RESET = "\x1b[0m";
const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

type Status = "pending" | "running" | "done" | "stopped";

interface WorkerState {
  id: string;
  title: string;
  agent: string;
  status: Status;
  action: string;
  steps: number;
  branch?: string;
  merge?: "ok" | "conflict";
}

export interface SwarmViewOptions {
  /** Animate + redraw in place. Defaults to whether stdout is a TTY. */
  tty?: boolean;
  /** Emit ANSI colors. Defaults to `tty` (disable for tests/plain output). */
  color?: boolean;
  /** Where to write (defaults to process.stdout). */
  sink?: (s: string) => void;
}

/** One-line summary of a tool call for the live view, e.g. `read_file src/x.ts`. */
export function describeToolCall(call: ToolCall): string {
  const raw = call.name === "run_command" ? call.arguments.command : call.arguments.path;
  const arg = typeof raw === "string" ? raw : "";
  const short = arg.length > 40 ? arg.slice(0, 39) + "…" : arg;
  return short ? `${call.name} ${short}` : call.name;
}

/**
 * Live, multi-line dashboard for the swarm: an orchestrator header plus one row
 * per worker showing its current action, step count and a spinner. Redraws in
 * place on a TTY; falls back to discrete event lines when piped.
 */
export class SwarmView {
  private readonly tty: boolean;
  private readonly color: boolean;
  private readonly write: (s: string) => void;
  private readonly workers = new Map<string, WorkerState>();
  private order: string[] = [];
  private phase: "decomposing" | "running" | "done" = "decomposing";
  private frame = 0;
  private lastLines = 0;
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly leadName: string, opts: SwarmViewOptions = {}) {
    this.tty = opts.tty ?? (Boolean(process.stdout.isTTY) && !process.env.NO_COLOR);
    this.color = opts.color ?? this.tty;
    this.write = opts.sink ?? ((s) => process.stdout.write(s));
  }

  start(): void {
    if (!this.tty) {
      this.write(`🐙 ${t("swarm.view.header", { lead: this.leadName })} — ${t("swarm.view.decomposing")}\n`);
      return;
    }
    this.flush();
    this.timer = setInterval(() => {
      this.frame = (this.frame + 1) % FRAMES.length;
      this.flush();
    }, 110);
    this.timer.unref?.();
  }

  setSubtasks(subtasks: Subtask[]): void {
    this.phase = "running";
    for (const s of subtasks) {
      this.workers.set(s.id, { id: s.id, title: s.title, agent: "", status: "pending", action: "", steps: 0 });
      this.order.push(s.id);
    }
    if (!this.tty) {
      this.write(`  ${t("swarm.decomposed", { n: subtasks.length })}\n`);
      for (const s of subtasks) this.write(`  ${s.id}: ${s.title}\n`);
    }
    this.flush();
  }

  workerStart(id: string, agent: string): void {
    const w = this.workers.get(id);
    if (!w) return;
    w.agent = agent;
    w.status = "running";
    if (!this.tty) this.write(`  ▶ ${id} [${agent}] ${w.title}\n`);
    this.flush();
  }

  workerAction(id: string, action: string): void {
    const w = this.workers.get(id);
    if (!w) return;
    w.action = action;
    this.flush();
  }

  workerStep(id: string, n: number): void {
    const w = this.workers.get(id);
    if (!w) return;
    w.steps = n;
    this.flush();
  }

  workerDone(o: WorkerOutcome): void {
    const w = this.workers.get(o.subtask.id);
    if (!w) return;
    w.status = o.finished ? "done" : "stopped";
    w.steps = o.steps;
    w.branch = o.branch;
    w.action = "";
    if (!this.tty) {
      const tag = o.finished ? "✓" : "■";
      const changes = o.committed ? t("swarm.changesCommitted") : t("swarm.noChanges");
      this.write(`  ${tag} ${o.subtask.id} (${t("swarm.view.steps", { n: o.steps })}, ${changes})\n`);
    }
    this.flush();
  }

  merge(r: MergeResult): void {
    for (const w of this.workers.values()) {
      if (w.branch === r.branch) w.merge = r.ok ? "ok" : "conflict";
    }
    if (!this.tty) {
      this.write(r.ok ? `  ⤵ ${t("swarm.merged", { branch: r.branch })}\n` : `  ✗ ${t("swarm.mergeConflict", { branch: r.branch })}\n`);
    }
    this.flush();
  }

  stop(): void {
    this.phase = "done";
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.flush(); // leave the final frame on screen
  }

  /** Content lines of the dashboard (no cursor control). Exposed for tests. */
  frameLines(): string[] {
    const spin = this.dim(FRAMES[this.frame]!);
    const lead = `🐙 ${t("swarm.view.header", { lead: this.leadName })}`;
    const lines: string[] = [];

    if (this.phase === "decomposing") {
      lines.push(`${spin} ${lead}`);
      lines.push("  " + this.dim(t("swarm.view.decomposing")));
      return lines;
    }

    lines.push(`${this.phase === "running" ? spin : "  "} ${lead}`);
    lines.push("");
    for (const id of this.order) {
      const w = this.workers.get(id)!;
      lines.push(this.row(w, spin));
    }
    return lines;
  }

  // -------------------------------------------------------------------------

  private row(w: WorkerState, spin: string): string {
    const icon =
      w.status === "running" ? spin
      : w.status === "done" ? this.c("✓", "32")
      : w.status === "stopped" ? this.c("■", "33")
      : this.dim("·");
    const status = this.statusLabel(w);
    const meta =
      w.steps > 0
        ? this.dim(" · " + (w.status === "running"
            ? t("swarm.view.step", { n: w.steps })
            : t("swarm.view.steps", { n: w.steps })))
        : "";
    const action = w.action ? w.action : this.dim("—");
    return `  ${icon} ${pad(w.id, 4)} ${pad(status, 12)} ${pad(`[${w.agent}]`, 14)} ${action}${meta}`;
  }

  private statusLabel(w: WorkerState): string {
    if (w.merge === "conflict") return this.c(t("swarm.view.conflict"), "31");
    if (w.status === "running") return this.c(t("swarm.view.running"), "36");
    if (w.status === "done") return this.c(t("swarm.view.done"), "32");
    if (w.status === "stopped") return this.c(t("swarm.view.stopped"), "33");
    return this.dim(t("swarm.view.pending"));
  }

  /** Redraw the block in place (TTY) by clearing the previous frame first. */
  private flush(): void {
    if (!this.tty) return;
    const lines = this.frameLines();
    let s = "";
    if (this.lastLines > 0) s += `\x1b[${this.lastLines}A`; // up to block top
    s += "\x1b[0J"; // clear from cursor to end of screen
    s += lines.join("\n") + "\n";
    this.write(s);
    this.lastLines = lines.length;
  }

  private c(s: string, code: string): string {
    return this.color ? `\x1b[${code}m${s}${RESET}` : s;
  }
  private dim(s: string): string {
    return this.color ? `\x1b[2m${s}${RESET}` : s;
  }
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}
