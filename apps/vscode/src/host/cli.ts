/**
 * How to invoke the Polypus CLI from the extension host (T6).
 *
 * Resolution order:
 *   1. `polypus.cliPath` setting — run that file with VSCode's Node.
 *   2. The self-contained CLI bundle shipped beside this file (`dist/cli.js`),
 *      run via VSCode's Node (`ELECTRON_RUN_AS_NODE`) — no global `polypus`/
 *      `node` and no node_modules required.
 *   3. A global `polypus` on PATH (last resort).
 *
 * Mirrors the desktop bridge's `cli()` so both shells behave identically.
 */
import * as vscode from "vscode";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface CliInvocation {
  cmd: string;
  baseArgs: string[];
  env: NodeJS.ProcessEnv;
}

export function resolveCli(): CliInvocation {
  const electronNode = { ...process.env, ELECTRON_RUN_AS_NODE: "1" };

  const configured = vscode.workspace.getConfiguration("polypus").get<string>("cliPath")?.trim();
  if (configured) {
    return { cmd: process.execPath, baseArgs: [configured], env: electronNode };
  }

  // dist/cli.mjs is emitted next to the compiled dist/extension.js (this file).
  const bundled = join(__dirname, "cli.mjs");
  if (existsSync(bundled)) {
    return { cmd: process.execPath, baseArgs: [bundled], env: electronNode };
  }

  // Last resort: a globally installed `polypus`.
  return { cmd: "polypus", baseArgs: [], env: { ...process.env } };
}

/** Run a one-shot `--json` CLI command and parse stdout. Never rejects. */
export function execCliJson(args: string[], cwd?: string, extraEnv?: Record<string, string>): Promise<unknown> {
  const { cmd, baseArgs, env } = resolveCli();
  return new Promise((resolve) => {
    execFile(cmd, [...baseArgs, ...args], { cwd, env: { ...env, ...extraEnv }, maxBuffer: 16 * 1024 * 1024 }, (err, stdout) => {
      if (err && !stdout) return resolve(null);
      try {
        resolve(JSON.parse(stdout.trim().split("\n").pop() ?? "null"));
      } catch {
        resolve(null);
      }
    });
  });
}
