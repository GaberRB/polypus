import { exec } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const MAX_OUTPUT = 8_000;

export interface CheckResult {
  command: string;
  ok: boolean;
  output: string;
}

/** True when a file exists in the workspace root. */
async function has(workspace: string, file: string): Promise<boolean> {
  try {
    await readFile(resolve(workspace, file), "utf8");
    return true;
  } catch {
    return false;
  }
}

/** npm scripts we treat as verification checks, in the order they should run. */
const NPM_CHECK_SCRIPTS = ["typecheck", "build", "test", "lint"] as const;

/** JS/TS: pick the standard `package.json` scripts that exist. */
async function detectNode(workspace: string): Promise<string[]> {
  try {
    const raw = await readFile(resolve(workspace, "package.json"), "utf8");
    const scripts = (JSON.parse(raw) as { scripts?: Record<string, string> }).scripts ?? {};
    return NPM_CHECK_SCRIPTS.filter((s) => typeof scripts[s] === "string").map((s) => `npm run ${s}`);
  } catch {
    return [];
  }
}

/** Rust: a Cargo project gets a type-check and the test suite. */
async function detectRust(workspace: string): Promise<string[]> {
  return (await has(workspace, "Cargo.toml")) ? ["cargo check", "cargo test"] : [];
}

/** Go: a module gets a build and the test suite. */
async function detectGo(workspace: string): Promise<string[]> {
  return (await has(workspace, "go.mod")) ? ["go build ./...", "go test ./..."] : [];
}

/**
 * Python: run the test suite when pytest config is present, plus declared
 * linters/type-checkers (ruff/mypy) when their tools are configured.
 */
async function detectPython(workspace: string): Promise<string[]> {
  const pyproject = await safeRead(workspace, "pyproject.toml");
  const hasPytestCfg = pyproject?.includes("[tool.pytest") || (await has(workspace, "pytest.ini"));
  const checks: string[] = [];
  if (pyproject?.includes("ruff")) checks.push("ruff check .");
  if (pyproject?.includes("mypy")) checks.push("mypy .");
  if (hasPytestCfg) checks.push("pytest -q");
  return checks;
}

async function safeRead(workspace: string, file: string): Promise<string | null> {
  try {
    return await readFile(resolve(workspace, file), "utf8");
  } catch {
    return null;
  }
}

/** Detectors run in turn; the first ecosystem that yields checks wins. */
const DETECTORS = [detectNode, detectRust, detectGo, detectPython] as const;

/**
 * Detect verification commands for a workspace across ecosystems (JS/TS, Rust,
 * Go, Python). Returns the checks of the first matching ecosystem, or an empty
 * array when there is nothing sensible to run.
 */
export async function detectChecks(workspace: string): Promise<string[]> {
  for (const detect of DETECTORS) {
    const checks = await detect(workspace);
    if (checks.length > 0) return checks;
  }
  return [];
}

/** Run the given commands in the workspace, capturing pass/fail and output. */
export async function runChecks(workspace: string, commands: string[]): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const command of commands) {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workspace,
        timeout: 300_000,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
      });
      results.push({ command, ok: true, output: clamp(`${stdout}${stderr ? `\n${stderr}` : ""}`.trim()) });
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; message: string };
      const body = `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() || e.message;
      results.push({ command, ok: false, output: clamp(body) });
    }
  }
  return results;
}

/** Build the corrective message fed back to the agent when checks fail. */
export function buildVerifyFeedback(failed: CheckResult[]): string {
  const blocks = failed
    .map((f) => `$ ${f.command}\n${f.output}`)
    .join("\n\n");
  return [
    "Verification failed. The following checks did not pass:",
    "",
    blocks,
    "",
    "Fix the underlying problem in the code (do not disable or skip the checks), then call `finish`.",
  ].join("\n");
}

function clamp(s: string): string {
  return s.length > MAX_OUTPUT ? s.slice(-MAX_OUTPUT) : s;
}
