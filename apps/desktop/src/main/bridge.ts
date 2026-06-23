import { execFile } from "node:child_process";
import { ipcMain } from "electron";
import { addRecentProject, listRecentProjects, listSessions } from "@gaberrb/polypus/lib";
import { IPC, type RecentProject, type Result, type SessionSummary } from "../shared/ipc";

/** Wrap an in-process core call so the renderer always gets a Result (never a throw). */
async function lib<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * How to invoke the Polypus CLI. Prefer the CLI bundled with the installed
 * `@gaberrb/polypus` dependency, run via Electron-as-Node — so neither a global
 * `polypus` nor an external `node` is required. `POLYPUS_CLI` overrides the path.
 */
function cli(): { cmd: string; baseArgs: string[]; env: NodeJS.ProcessEnv } {
  const override = process.env.POLYPUS_CLI;
  if (override) return { cmd: "node", baseArgs: [override], env: process.env };
  try {
    // exports "." → dist/index.js (the CLI). Run it with Electron's own Node.
    const entry = require.resolve("@gaberrb/polypus");
    return {
      cmd: process.execPath,
      baseArgs: [entry],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    };
  } catch {
    return { cmd: "polypus", baseArgs: [], env: process.env };
  }
}

/** Run a headless `--json` CLI command and parse stdout. Never rejects. */
function runCli(args: string[]): Promise<Result<unknown>> {
  return new Promise((resolve) => {
    const { cmd, baseArgs, env } = cli();
    execFile(cmd, [...baseArgs, ...args], { env, maxBuffer: 64 * 1024 * 1024 }, (err, stdout) => {
      if (err && !stdout) {
        resolve({ ok: false, error: err.message });
        return;
      }
      try {
        resolve({ ok: true, data: JSON.parse(stdout) });
      } catch {
        resolve({ ok: false, error: "Resposta não-JSON do polypus." });
      }
    });
  });
}

/**
 * Run a CLI command that emits plain text (not JSON), e.g. `index`/`retrieve`.
 * Returns stdout (or stderr, which is where `index` prints its status). Never rejects.
 */
function runCliText(args: string[], cwd?: string): Promise<Result<string>> {
  return new Promise((resolve) => {
    const { cmd, baseArgs, env } = cli();
    execFile(
      cmd,
      [...baseArgs, ...args],
      { cwd: cwd || process.cwd(), env, maxBuffer: 64 * 1024 * 1024 },
      (err, stdout, stderr) => {
        const out = (stdout?.trim() ? stdout : stderr) || "";
        if (err && !out.trim()) resolve({ ok: false, error: err.message });
        else if (err) resolve({ ok: false, error: out.trim() });
        else resolve({ ok: true, data: out.trim() });
      },
    );
  });
}

/** Wire the IPC handlers. Call once after the app is ready. */
export function registerBridge(): void {
  ipcMain.handle(IPC.estimate, (_e, task: string) => runCli(["estimate", task, "--json"]));
  ipcMain.handle(IPC.review, (_e, pr: string) => runCli(["review", String(pr), "--json"]));
  ipcMain.handle(IPC.run, (_e, task: string, mode: string) => {
    const m = mode === "plan" || mode === "review" || mode === "bypass" ? mode : "review";
    return runCli(["run", task, "--json", "--mode", m]);
  });
  // RAG (#121): build/query the repo index for the given project dir.
  ipcMain.handle(IPC.index, (_e, dir?: string) => runCliText(["index"], dir));
  ipcMain.handle(IPC.retrieve, (_e, query: string, dir?: string) =>
    runCliText(["retrieve", query], dir),
  );

  // Sidebar (#117): recent projects + sessions, in-process via @gaberrb/polypus/lib.
  ipcMain.handle(IPC.recentList, (): Promise<Result<RecentProject[]>> => lib(listRecentProjects));
  ipcMain.handle(IPC.recentAdd, (_e, path: string) => lib(() => addRecentProject(path)));
  ipcMain.handle(IPC.sessionsList, (): Promise<Result<SessionSummary[]>> => lib(listSessions));
}
