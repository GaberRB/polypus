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

function clamp(s: string): string {
  return s.length > MAX_OUTPUT ? s.slice(0, MAX_OUTPUT) + "\n…[truncated]" : s;
}
