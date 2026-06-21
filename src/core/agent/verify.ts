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

/** npm scripts we treat as verification checks, in the order they should run. */
const CHECK_SCRIPTS = ["typecheck", "build", "test"] as const;

/**
 * Detect verification commands for a workspace. Today this reads `package.json`
 * scripts and picks the standard checks (`typecheck`, `build`, `test`). Returns
 * an empty array when there is nothing sensible to run.
 */
export async function detectChecks(workspace: string): Promise<string[]> {
  try {
    const raw = await readFile(resolve(workspace, "package.json"), "utf8");
    const scripts = (JSON.parse(raw) as { scripts?: Record<string, string> }).scripts ?? {};
    return CHECK_SCRIPTS.filter((s) => typeof scripts[s] === "string").map((s) => `npm run ${s}`);
  } catch {
    return [];
  }
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
