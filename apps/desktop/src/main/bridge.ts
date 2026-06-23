import { execFile } from "node:child_process";
import { ipcMain } from "electron";
import { IPC, type Result } from "../shared/ipc";

/**
 * How to invoke the Polypus CLI. Set `POLYPUS_CLI` to a built entry
 * (e.g. ../../dist/index.js) to run it with Node; otherwise `polypus` on PATH.
 */
function cli(): { cmd: string; baseArgs: string[] } {
  const override = process.env.POLYPUS_CLI;
  return override ? { cmd: "node", baseArgs: [override] } : { cmd: "polypus", baseArgs: [] };
}

/** Run a headless `--json` CLI command and parse stdout. Never rejects. */
function runCli(args: string[]): Promise<Result<unknown>> {
  return new Promise((resolve) => {
    const { cmd, baseArgs } = cli();
    execFile(cmd, [...baseArgs, ...args], { maxBuffer: 64 * 1024 * 1024 }, (err, stdout) => {
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

/** Wire the IPC handlers. Call once after the app is ready. */
export function registerBridge(): void {
  ipcMain.handle(IPC.estimate, (_e, task: string) => runCli(["estimate", task, "--json"]));
  ipcMain.handle(IPC.review, (_e, pr: string) => runCli(["review", String(pr), "--json"]));
  ipcMain.handle(IPC.run, (_e, task: string, mode: string) => {
    const m = mode === "plan" || mode === "review" || mode === "bypass" ? mode : "review";
    return runCli(["run", task, "--json", "--mode", m]);
  });
}
