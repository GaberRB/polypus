/**
 * How to invoke the Polypus CLI from the extension host (T6 backbone).
 *
 * Resolution order:
 *   1. `polypus.cliPath` setting — run that file with VSCode's Node.
 *   2. The bundled `@gaberrb/polypus` dependency — run its entry with VSCode's
 *      Node via `ELECTRON_RUN_AS_NODE` (no global `polypus`/`node` required).
 *   3. A global `polypus` on PATH (last resort).
 *
 * Mirrors the desktop bridge's `cli()` so both shells behave identically.
 */
import * as vscode from "vscode";

export interface CliInvocation {
  cmd: string;
  baseArgs: string[];
  env: NodeJS.ProcessEnv;
}

export function resolveCli(): CliInvocation {
  const configured = vscode.workspace.getConfiguration("polypus").get<string>("cliPath")?.trim();
  if (configured) {
    return { cmd: process.execPath, baseArgs: [configured], env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" } };
  }
  try {
    // The CLI's package entry ("." → dist/index.js), bundled with the extension.
    const entry = require.resolve("@gaberrb/polypus");
    return {
      cmd: process.execPath,
      baseArgs: [entry],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    };
  } catch {
    // No bundled CLI found — fall back to a global install.
    return { cmd: "polypus", baseArgs: [], env: { ...process.env } };
  }
}
