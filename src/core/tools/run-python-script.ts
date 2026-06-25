import { spawn, spawnSync } from "node:child_process";
import { z } from "zod";
import type { Tool, ToolResult } from "./types.js";

const Args = z.object({ script: z.string().min(1) });
const MAX_OUTPUT = 20_000;
const TIMEOUT_MS = 120_000;

// Interpreters to try, in order. `python3` first because on many systems `python`
// is missing or still points at Python 2.
const INTERPRETERS = ["python3", "python"] as const;

export const runPythonScriptTool: Tool = {
  mutating: true,
  spec: {
    name: "run_python_script",
    description:
      "Run an inline Python 3 script in the workspace to read or transform structured files " +
      "(CSV, JSON, XML, YAML, spreadsheets, SQL dumps). The script runs with the workspace as its " +
      "working directory — open files by relative path and print the values you need to stdout. " +
      "Prefer read_file for plain text; use this when parsing a structured file by hand would be brittle.",
    parameters: {
      type: "object",
      properties: {
        script: {
          type: "string",
          description:
            "Python 3 source to execute. Read files relative to the workspace and print results to stdout.",
        },
      },
      required: ["script"],
    },
  },
  async run(rawArgs, ctx) {
    const args = Args.safeParse(rawArgs);
    if (!args.success) return { ok: false, output: "Invalid args: 'script' is required." };

    // Running arbitrary Python is at least as powerful as run_command, so gate it the
    // same way: the permission mode (plan/review/bypass) and the dangerous-command
    // screen both run over the script text before anything executes.
    const decision = await ctx.permissions.authorizeCommand(args.data.script);
    if (!decision.allowed) return { ok: false, output: `Command denied: ${decision.reason}` };

    return runPython(args.data.script, ctx.workspace);
  },
};

async function runPython(script: string, cwd: string): Promise<ToolResult> {
  const bin = findInterpreter();
  if (!bin) {
    return {
      ok: false,
      output: "Python not found (tried python3, python). Install Python 3 to use run_python_script.",
    };
  }
  return runOnce(bin, script, cwd);
}

/**
 * Probe each candidate with `--version` and return the first that actually runs.
 * A plain ENOENT fallback is not enough on Windows, where `python3` is often the
 * Microsoft Store App Execution Alias: it is not missing (no ENOENT) but exits
 * non-zero without running Python, so we must verify rather than assume.
 */
function findInterpreter(): string | null {
  for (const bin of INTERPRETERS) {
    const r = spawnSync(bin, ["--version"], { windowsHide: true });
    if (!r.error && r.status === 0) return bin;
  }
  return null;
}

/**
 * Spawn the interpreter and feed the script over stdin (`python3 -`). Passing the
 * source through stdin instead of building a `python -c "…"` string removes the shell
 * entirely, so there is no quoting/escaping or command-injection surface.
 */
function runOnce(bin: string, script: string, cwd: string): Promise<ToolResult> {
  return new Promise((resolve) => {
    const child = spawn(bin, ["-"], { cwd, windowsHide: true });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;

    const finish = (result: ToolResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, TIMEOUT_MS);

    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    child.on("error", (err: NodeJS.ErrnoException) => {
      finish({ ok: false, output: `Failed to run Python: ${err.message}` });
    });

    child.on("close", (code) => {
      if (timedOut) {
        return finish({ ok: false, output: `Python script timed out after ${TIMEOUT_MS / 1000}s.` });
      }
      if (code === 0) {
        const out = `${stdout}${stderr ? `\n[stderr]\n${stderr}` : ""}`.trim();
        return finish({ ok: true, output: clamp(out || "(no output)") });
      }
      const body = `${stdout}${stderr}`.trim();
      finish({ ok: false, output: clamp(`Python script failed (exit ${code ?? "?"}):\n${body}`) });
    });

    // Ignore EPIPE if the process died before consuming stdin.
    child.stdin.on("error", () => {});
    child.stdin.write(script);
    child.stdin.end();
  });
}

function clamp(s: string): string {
  return s.length > MAX_OUTPUT ? s.slice(0, MAX_OUTPUT) + "\n…[truncated]" : s;
}
