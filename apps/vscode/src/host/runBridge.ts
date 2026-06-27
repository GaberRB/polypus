/**
 * Run bridge (T4) — spawns `polypus run --json --stream` and forwards each
 * NDJSON line to the webview, mirroring the desktop bridge (bridge.ts:423-486).
 * One active child at a time; `stop()` kills it, `respond()` answers an
 * `ask_user` card over the child's stdin.
 */
import { spawn, type ChildProcess } from "node:child_process";
import type { StreamEvent, RunControls } from "@gaberrb/polypus-chat-ui";
import { resolveCli } from "./cli.js";

export interface RunOptions {
  task: string;
  controls: RunControls;
  cwd: string;
  resumeSessionId?: string;
  /** Extra env (e.g. the OpenRouter key from SecretStorage). */
  env?: Record<string, string>;
}

export class RunBridge {
  private child: ChildProcess | undefined;

  /** Start a run, pushing every event (incl. terminal `end`/`error`) to `onEvent`. */
  start(opts: RunOptions, onEvent: (ev: StreamEvent) => void): void {
    this.stop(); // never run two at once

    const { cmd, baseArgs, env } = resolveCli();
    const { mode, agent, profile } = opts.controls;
    const safeMode = mode === "plan" || mode === "review" || mode === "bypass" ? mode : "review";

    const args = [...baseArgs, "run", opts.task, "--json", "--stream", "--mode", safeMode];
    if (agent) args.push("--agent", agent);
    if (profile === "fast") args.push("--fast");
    else if (profile === "quality") args.push("--quality");
    if (opts.resumeSessionId) args.push("--resume", opts.resumeSessionId);

    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: { ...env, ...opts.env },
    });
    this.child = child;

    let buf = "";
    let stderr = "";

    child.stdout?.on("data", (d: Buffer) => {
      buf += d.toString();
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        try {
          onEvent(JSON.parse(line) as StreamEvent);
        } catch {
          /* ignore non-JSON noise on stdout */
        }
      }
    });

    child.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });

    child.on("error", (err) => onEvent({ type: "error", message: err.message }));
    child.on("close", (code) => {
      if (this.child === child) this.child = undefined;
      if (code !== 0 && !child.killed && stderr.trim()) {
        onEvent({ type: "error", message: stderr.trim() });
      }
      onEvent({ type: "end", code });
    });
  }

  /** Answer a pending `ask_user` card by writing the response line to stdin. */
  respond(id: number, selected: string[] | null): void {
    this.child?.stdin?.write(JSON.stringify({ type: "ask_response", id, selected }) + "\n");
  }

  /** Kill the active run, if any. */
  stop(): void {
    if (this.child) {
      this.child.kill("SIGTERM");
      this.child = undefined;
    }
  }
}
