import { exec } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const MAX_OUTPUT = 4_000;

/** Files we bother type/lint-checking after an edit. */
const SOURCE_EXT = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|py)$/i;

export type DiagnosticsMode = "auto" | "on" | "off";

/**
 * A fast, scoped check to run after edits. `perFile` probes take the touched
 * files as arguments (ruff); whole-project probes (tsc) analyze the whole program
 * and we filter the output down to the touched files afterwards.
 */
export interface DiagnosticProbe {
  command: string;
  /** Which touched files this probe applies to. */
  match: RegExp;
  /** Append the touched files to the command instead of running whole-project. */
  perFile?: boolean;
}

async function has(workspace: string, file: string): Promise<boolean> {
  try {
    await readFile(resolve(workspace, file), "utf8");
    return true;
  } catch {
    return false;
  }
}

async function safeRead(workspace: string, file: string): Promise<string | null> {
  try {
    return await readFile(resolve(workspace, file), "utf8");
  } catch {
    return null;
  }
}

/** Per-workspace incremental buildinfo so repeat tsc runs only recheck changes. */
function tsBuildInfo(workspace: string): string {
  const hash = createHash("sha1").update(workspace).digest("hex").slice(0, 12);
  return join(tmpdir(), `polypus-tsc-${hash}.tsbuildinfo`);
}

function quote(p: string): string {
  return `"${p.replace(/"/g, '\\"')}"`;
}

/**
 * Detect which fast diagnostics apply to a workspace. TypeScript projects get an
 * incremental `tsc --noEmit`; Python projects with ruff configured get `ruff
 * check`. Empty array means nothing to run (zero overhead).
 */
export async function detectDiagnostics(workspace: string): Promise<DiagnosticProbe[]> {
  const probes: DiagnosticProbe[] = [];
  if (await has(workspace, "tsconfig.json")) {
    probes.push({
      command: `npx --no-install tsc --noEmit --incremental --tsBuildInfoFile ${quote(tsBuildInfo(workspace))}`,
      match: /\.(ts|tsx|mts|cts)$/i,
    });
  }
  const pyproject = await safeRead(workspace, "pyproject.toml");
  if (pyproject?.includes("ruff") || (await has(workspace, "ruff.toml"))) {
    probes.push({ command: "ruff check --quiet", match: /\.py$/i, perFile: true });
  }
  return probes;
}

/** Keep only output lines that reference one of the touched files. */
function filterToFiles(output: string, files: string[]): string {
  const rels = files.map((f) => f.replace(/\\/g, "/"));
  const bases = rels.map((r) => r.split("/").pop() ?? r);
  const lines = output.split(/\r?\n/).filter((raw) => {
    const line = raw.replace(/\\/g, "/");
    return rels.some((rel, i) => line.includes(rel) || line.includes(bases[i]!));
  });
  return lines.join("\n").trim();
}

function clamp(s: string): string {
  return s.length > MAX_OUTPUT ? s.slice(0, MAX_OUTPUT) : s;
}

export interface RunDiagnosticsOptions {
  /** Pre-detected probes; detected from the workspace when omitted. */
  probes?: DiagnosticProbe[];
  /** Per-probe wall-clock budget; a probe that overruns is skipped silently. */
  timeoutMs?: number;
}

/**
 * Run the applicable diagnostics for the touched files and return the errors
 * scoped to those files, or null when clean, skipped, or timed out. Best-effort:
 * spawn failures and timeouts never throw — diagnostics must not disrupt the loop.
 */
export async function runDiagnostics(
  workspace: string,
  touched: string[],
  opts: RunDiagnosticsOptions = {},
): Promise<string | null> {
  const files = [...new Set(touched)].filter((f) => SOURCE_EXT.test(f));
  if (files.length === 0) return null;
  const probes = opts.probes ?? (await detectDiagnostics(workspace));
  if (probes.length === 0) return null;
  const timeout = opts.timeoutMs ?? 10_000;

  const blocks: string[] = [];
  for (const probe of probes) {
    const relevant = files.filter((f) => probe.match.test(f));
    if (relevant.length === 0) continue;
    const command = probe.perFile ? `${probe.command} ${relevant.map(quote).join(" ")}` : probe.command;
    let output: string;
    try {
      const r = await execAsync(command, { cwd: workspace, timeout, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
      output = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; killed?: boolean; signal?: string; message: string };
      // Timed out (killed by the timeout) or the tool isn't installed → skip.
      if (e.killed || e.signal === "SIGTERM" || /not found|not recognized|ENOENT/i.test(e.message)) continue;
      output = `${e.stdout ?? ""}\n${e.stderr ?? ""}`.trim() || e.message;
    }
    const filtered = filterToFiles(output, relevant);
    if (filtered) blocks.push(filtered);
  }
  return blocks.length > 0 ? clamp(blocks.join("\n")) : null;
}

/** The feedback appended to the model's turn after edits introduce diagnostics. */
export function buildDiagnosticsFeedback(output: string): string {
  return [
    "Diagnostics after your edits reported problems in the files you just changed:",
    "",
    output,
    "",
    "Fix these before continuing (do not suppress or ignore them).",
  ].join("\n");
}
