import { exec } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import type { Tool } from "./types.js";

const execAsync = promisify(exec);
const Args = z.object({ command: z.string().min(1) });
const MAX_OUTPUT = 20_000;

export const runCommandTool: Tool = {
  mutating: true,
  spec: {
    name: "run_command",
    description: "Run a shell command in the workspace and return its combined stdout/stderr.",
    parameters: {
      type: "object",
      properties: { command: { type: "string", description: "Shell command to execute" } },
      required: ["command"],
    },
  },
  async run(rawArgs, ctx) {
    const args = Args.safeParse(rawArgs);
    if (!args.success) return { ok: false, output: "Invalid args: 'command' is required." };

    // A long-running server started here would block (never returns) and stall the
    // run; refuse with guidance instead of hanging until the timeout.
    if (looksLikeLongRunningServer(args.data.command)) {
      return {
        ok: false,
        output:
          "Refused: this looks like a long-running server/watcher, which blocks run_command " +
          "(it never returns) and stalls the run. Do NOT start dev servers here. To verify the " +
          "project, run one-shot checks instead — e.g. `npm run build`, `npm test`, `npm run typecheck`. " +
          "If a running server is truly required, leave it for the user to start separately.",
      };
    }

    const decision = await ctx.permissions.authorizeCommand(args.data.command);
    if (!decision.allowed) return { ok: false, output: `Command denied: ${decision.reason}` };

    try {
      const { stdout, stderr } = await execAsync(args.data.command, {
        cwd: ctx.workspace,
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
      });
      return { ok: true, output: clamp(`${stdout}${stderr ? `\n[stderr]\n${stderr}` : ""}`.trim() || "(no output)") };
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; message: string; code?: number };
      const body = `${e.stdout ?? ""}${e.stderr ?? ""}`.trim();
      return {
        ok: false,
        output: clamp(`Command failed (exit ${e.code ?? "?"}): ${e.message}\n${body}`),
      };
    }
  },
};

/**
 * Heuristic for commands that start a process which doesn't return (dev servers,
 * watchers, daemons). Running these via run_command blocks until the timeout and
 * makes the agent loop. Conservative patterns to avoid false positives on builds.
 */
const SERVER_PATTERNS: RegExp[] = [
  /\bstart\s+\/b\b/i, // Windows: start /B <cmd>  (detached, but the pipe blocks)
  /\bnodemon\b/i,
  /\bnpm\s+(run\s+)?(dev|start|serve|watch)\b/i,
  /\b(yarn|pnpm|bun)\s+(dev|start|serve|watch)\b/i,
  /\bnext\s+dev\b/i,
  /\bvite\b(?!\s+build)/i,
  /\b(http-server|live-server|serve|webpack-dev-server)\b/i,
  /\bnest\s+start\b/i,
  /--watch\b/i,
];

export function looksLikeLongRunningServer(command: string): boolean {
  return SERVER_PATTERNS.some((re) => re.test(command));
}

function clamp(s: string): string {
  return s.length > MAX_OUTPUT ? s.slice(0, MAX_OUTPUT) + "\n…[truncated]" : s;
}
