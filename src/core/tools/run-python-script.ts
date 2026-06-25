import { spawn, spawnSync } from "node:child_process";
import { z } from "zod";
import type { Tool, ToolResult } from "./types.js";

const Args = z.object({ script: z.string().min(1) });
const MAX_OUTPUT = 20_000;
const TIMEOUT_MS = 120_000;
// Hard cap on bytes read from the child before we kill it. We only ever keep
// MAX_OUTPUT, but a runaway `while True: print(...)` would otherwise balloon
// memory for the whole timeout window — this mirrors run_command's maxBuffer guard.
const OUTPUT_HARD_LIMIT = 10 * 1024 * 1024;

// Interpreters to try, in order, as argv prefixes. `python3` first because on many
// systems `python` is missing or still points at Python 2; `py -3` covers Windows
// installs where only the Python launcher is on PATH.
const INTERPRETERS: readonly (readonly string[])[] = [["python3"], ["python"], ["py", "-3"]];

export const runPythonScriptTool: Tool = {
  mutating: true,
  spec: {
    name: "run_python_script",
    description:
      "Run an inline Python 3 script in the workspace to read or transform structured files using the " +
      "standard library (JSON, CSV, XML, SQLite). The script runs with the workspace as its working " +
      "directory — open files by relative path and print the values you need to stdout. Formats that " +
      "need third-party packages (e.g. YAML, .xlsx) work only if that package is installed in the " +
      "environment. Prefer read_file for plain text; use this when parsing a structured file by hand " +
      "would be brittle.",
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

// Cache the working interpreter for the process lifetime — probing spawns a child,
// so doing it on every call is wasteful. Negative results are not cached, so a
// Python install done mid-session is still picked up.
let cachedInterpreter: readonly string[] | null = null;

async function runPython(script: string, cwd: string): Promise<ToolResult> {
  const argv = findInterpreter();
  if (!argv) {
    return {
      ok: false,
      output: "Python not found (tried python3, python, py -3). Install Python 3 to use run_python_script.",
    };
  }
  return runOnce(argv, script, cwd);
}

/**
 * Probe each candidate with `--version` and return the argv prefix of the first that
 * actually runs. A plain ENOENT fallback is not enough on Windows, where `python3` is
 * often the Microsoft Store App Execution Alias: it is not missing (no ENOENT) but
 * exits non-zero without running Python, so we must verify rather than assume.
 * Exported so the test uses the exact same detection as the tool.
 */
export function findInterpreter(): readonly string[] | null {
  if (cachedInterpreter) return cachedInterpreter;
  for (const argv of INTERPRETERS) {
    const r = spawnSync(argv[0]!, [...argv.slice(1), "--version"], { windowsHide: true });
    if (!r.error && r.status === 0) return (cachedInterpreter = argv);
  }
  return null;
}

/**
 * Spawn the interpreter and feed the script over stdin (`python3 -`). Passing the
 * source through stdin instead of building a `python -c "…"` string removes the shell
 * entirely, so there is no quoting/escaping or command-injection surface.
 */
function runOnce(argv: readonly string[], script: string, cwd: string): Promise<ToolResult> {
  return new Promise((resolve) => {
    const child = spawn(argv[0]!, [...argv.slice(1), "-"], { cwd, windowsHide: true });
    let stdout = "";
    let stderr = "";
    let total = 0;
    let settled = false;
    let timedOut = false;
    let overflowed = false;
    let killFallback: ReturnType<typeof setTimeout> | undefined;

    const finish = (result: ToolResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(killFallback);
      resolve(result);
    };

    // Kill the child and, in case it ignores the signal or never emits `close`,
    // arm a short fallback so the promise can never hang forever.
    const killAndGuard = () => {
      child.kill("SIGKILL");
      killFallback = setTimeout(() => finish(killResult()), 2_000);
    };
    const killResult = (): ToolResult => ({
      ok: false,
      output: overflowed
        ? "Python script produced too much output (>10 MB) and was aborted."
        : `Python script timed out after ${TIMEOUT_MS / 1000}s.`,
    });

    const timer = setTimeout(() => {
      timedOut = true;
      killAndGuard();
    }, TIMEOUT_MS);

    const onData = (buf: Buffer, sink: "out" | "err") => {
      total += buf.length;
      // Keep only what we might display (output is clamped to MAX_OUTPUT anyway);
      // drop the rest so a chatty script can't grow these strings without bound.
      if (sink === "out") {
        if (stdout.length < MAX_OUTPUT) stdout += buf.toString();
      } else if (stderr.length < MAX_OUTPUT) {
        stderr += buf.toString();
      }
      if (total > OUTPUT_HARD_LIMIT && !overflowed) {
        overflowed = true;
        killAndGuard();
      }
    };

    child.stdout.on("data", (d) => onData(d, "out"));
    child.stderr.on("data", (d) => onData(d, "err"));

    child.on("error", (err: NodeJS.ErrnoException) => {
      finish({ ok: false, output: `Failed to run Python: ${err.message}` });
    });

    child.on("close", (code) => {
      if (overflowed || timedOut) return finish(killResult());
      if (code === 0) {
        const out = `${stdout}${stderr ? `\n[stderr]\n${stderr}` : ""}`.trim();
        return finish({ ok: true, output: clamp(out || "(no output)") });
      }
      const body = `${stdout}${stderr}`.trim();
      const hint = moduleHint(body);
      finish({
        ok: false,
        output: clamp(`Python script failed (exit ${code ?? "?"}):\n${body}${hint ? `\n\n${hint}` : ""}`),
      });
    });

    // Feed the script over stdin. Wrap in try/catch because writing to a process
    // that died on startup can throw synchronously — tools must never throw.
    try {
      child.stdin.on("error", () => {});
      child.stdin.write(script);
      child.stdin.end();
    } catch {
      /* the error/close handlers settle the result */
    }
  });
}

// pip package names that differ from the importable module name, for a better hint.
const PIP_NAMES: Record<string, string> = { yaml: "pyyaml", PIL: "pillow", cv2: "opencv-python", bs4: "beautifulsoup4" };

/**
 * If the failure is a missing third-party module, turn the raw traceback into an
 * actionable hint instead of leaving the model to guess. The description steers
 * the model to stdlib formats, but it can still reach for e.g. `import yaml`.
 */
export function moduleHint(body: string): string | null {
  const m = body.match(/ModuleNotFoundError: No module named '([\w.]+)'/);
  if (!m) return null;
  const mod = m[1]!.split(".")[0]!;
  const pkg = PIP_NAMES[mod] ?? mod;
  return `Hint: the Python module '${mod}' is not installed. Run \`pip install ${pkg}\`, or use a standard-library format (json, csv, xml, sqlite3) instead.`;
}

function clamp(s: string): string {
  return s.length > MAX_OUTPUT ? s.slice(0, MAX_OUTPUT) + "\n…[truncated]" : s;
}
