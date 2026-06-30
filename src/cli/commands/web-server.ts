/**
 * `polypus web-server` — WebSocket server that lets the Chrome extension
 * communicate with the Polypus CLI.
 *
 * For each "run" message, it spawns `polypus run --json --stream` as a child
 * process and forwards NDJSON events line-by-line to the WebSocket client.
 * Supports "stop", "respond_ask", and "respond_confirm" messages to control
 * the child process interactively.
 *
 * The `ws` package handles the WebSocket protocol; the CLI discovery reuses
 * the same resolution chain as `run.ts` (its own binary via process.argv[1]).
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import pc from "picocolors";
import { t } from "../../core/i18n/index.js";

interface RunMessage {
  type: "run";
  task: string;
  mode?: string;
  agent?: string;
}

interface StopMessage {
  type: "stop";
}

interface RespondAskMessage {
  type: "respond_ask";
  id: number;
  selected: string[] | null;
}

interface RespondConfirmMessage {
  type: "respond_confirm";
  id: number;
  approved: boolean;
}

type WsMessage = RunMessage | StopMessage | RespondAskMessage | RespondConfirmMessage;

export interface WebServerOptions {
  port?: string;
  allowOrigin?: string;
}

/**
 * Start a WebSocket server that bridges the Chrome extension to the CLI.
 * Defaults to port 9876; listens on 127.0.0.1 only for security.
 */
export async function webServerCommand(opts: WebServerOptions): Promise<void> {
  const port = Number(opts.port) || 9876;

  const server = createServer();
  const wss = new WebSocketServer({ server });

  let child: ChildProcess | null = null;

  wss.on("connection", (ws, req) => {
    const addr = req.socket.remoteAddress ?? "unknown";
    process.stderr.write(pc.green(`✓ ${t("webServer.clientConnected", { addr })}`) + "\n");

    ws.on("message", (raw) => {
      let msg: WsMessage;
      try {
        msg = JSON.parse(raw.toString()) as WsMessage;
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "Invalid JSON body." }));
        return;
      }

      switch (msg.type) {
        case "run": {
          if (!msg.task?.trim()) {
            ws.send(JSON.stringify({ type: "error", message: "task is required." }));
            return;
          }

          // Kill any prior run.
          if (child) {
            child.kill("SIGTERM");
            child = null;
          }

          const args = ["run", msg.task, "--json", "--stream"];
          if (msg.mode === "plan" || msg.mode === "review" || msg.mode === "bypass") {
            args.push("--mode", msg.mode);
          }
          if (msg.agent) args.push("--agent", msg.agent);

          // Resolve the CLI entry — spawn our own binary (dist/index.js) via Node.
          const entry = process.argv[1] ?? process.execPath;
          const proc = spawn(process.execPath, [entry, ...args], {
            cwd: process.cwd(),
            stdio: ["pipe", "pipe", "pipe"],
            env: { ...process.env },
          });
          child = proc;

          const taskLabel = msg.task.slice(0, 48);
          process.stderr.write(pc.dim(`  → ${t("webServer.running", { task: taskLabel })}`) + "\n");

          let buf = "";
          proc.stdout?.on("data", (data: Buffer) => {
            buf += data.toString();
            let nl: number;
            while ((nl = buf.indexOf("\n")) >= 0) {
              const line = buf.slice(0, nl).trim();
              buf = buf.slice(nl + 1);
              if (line) {
                try {
                  ws.send(line);
                } catch {
                  /* client disconnected; ignore */
                }
              }
            }
          });

          proc.stderr?.on("data", (data: Buffer) => {
            process.stderr.write(data);
          });

          proc.on("error", (err) => {
            ws.send(JSON.stringify({ type: "error", message: err.message }));
          });

          proc.on("close", (code) => {
            if (child === proc) child = null;
            ws.send(JSON.stringify({ type: "end", code: code ?? 0 }));
          });

          break;
        }

        case "stop":
          if (child) {
            child.kill("SIGTERM");
            child = null;
          }
          break;

        case "respond_ask":
          child?.stdin?.write(JSON.stringify({ type: "ask_response", id: msg.id, selected: msg.selected }) + "\n");
          break;

        case "respond_confirm":
          child?.stdin?.write(
            JSON.stringify({ type: "confirm_response", id: msg.id, approved: msg.approved }) + "\n",
          );
          break;
      }
    });

    ws.on("close", () => {
      if (child) {
        child.kill("SIGTERM");
        child = null;
      }
    });
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(pc.bold(`🐙 ${t("webServer.listening", { port })}`));
  });

  // Graceful shutdown on SIGINT/SIGTERM.
  const shutdown = (): void => {
    if (child) child.kill("SIGTERM");
    wss.close();
    server.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}