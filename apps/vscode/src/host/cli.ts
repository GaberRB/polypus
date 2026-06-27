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
