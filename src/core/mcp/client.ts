import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";

/** A tool advertised by an MCP server. */
export interface McpToolDef {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

const PROTOCOL_VERSION = "2024-11-05";

/**
 * Minimal MCP client over the stdio transport: newline-delimited JSON-RPC 2.0.
 * Supports the bits Polypus needs — `initialize`, `tools/list`, `tools/call` —
 * with no external dependency. Spawn → initialize() → listTools()/callTool() → close().
 */
export class McpClient {
  private proc?: ChildProcessWithoutNullStreams;
  private nextId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private buffer = "";
  private closed = false;

  constructor(
    private readonly command: string,
    private readonly args: string[] = [],
    private readonly env: Record<string, string> = {},
  ) {}

  /** Spawn the server and perform the initialize handshake. */
  async initialize(timeoutMs = 20_000): Promise<void> {
    this.proc = spawn(this.command, this.args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...this.env },
      windowsHide: true,
    }) as ChildProcessWithoutNullStreams;

    this.proc.stdout.setEncoding("utf8");
    this.proc.stdout.on("data", (chunk: string) => this.onData(chunk));
    this.proc.on("exit", () => this.failAll(new Error("MCP server process exited")));
    this.proc.on("error", (err) => this.failAll(err));

    await this.request(
      "initialize",
      {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "polypus", version: "1" },
      },
      timeoutMs,
    );
    // Per the spec, tell the server we're ready (notification — no response).
    this.notify("notifications/initialized");
  }

  /** List the tools the server exposes. */
  async listTools(): Promise<McpToolDef[]> {
    const res = (await this.request("tools/list", {})) as { tools?: McpToolDef[] };
    return res.tools ?? [];
  }

  /** Call a tool and return its textual output. */
  async callTool(name: string, args: Record<string, unknown>): Promise<{ ok: boolean; text: string }> {
    try {
      const res = (await this.request("tools/call", { name, arguments: args })) as {
        content?: Array<{ type: string; text?: string }>;
        isError?: boolean;
      };
      const text = (res.content ?? [])
        .map((c) => (c.type === "text" ? (c.text ?? "") : `[${c.type}]`))
        .join("\n")
        .trim();
      return { ok: !res.isError, text: text || "(no output)" };
    } catch (err) {
      return { ok: false, text: `MCP call failed: ${(err as Error).message}` };
    }
  }

  /** Terminate the server process. */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.failAll(new Error("MCP client closed"));
    this.proc?.kill();
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    let nl: number;
    while ((nl = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, nl).trim();
      this.buffer = this.buffer.slice(nl + 1);
      if (!line) continue;
      let msg: { id?: number; result?: unknown; error?: { message?: string } };
      try {
        msg = JSON.parse(line);
      } catch {
        continue; // ignore non-JSON lines (some servers log to stdout)
      }
      if (typeof msg.id !== "number") continue; // notification / unrelated
      const p = this.pending.get(msg.id);
      if (!p) continue;
      this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message ?? "MCP error"));
      else p.resolve(msg.result);
    }
  }

  private request(method: string, params: unknown, timeoutMs = 20_000): Promise<unknown> {
    if (!this.proc) return Promise.reject(new Error("MCP client not initialized"));
    const id = this.nextId++;
    const payload = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request "${method}" timed out`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      this.proc!.stdin.write(payload);
    });
  }

  private notify(method: string, params: unknown = {}): void {
    this.proc?.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
  }

  private failAll(err: Error): void {
    for (const [, p] of this.pending) p.reject(err);
    this.pending.clear();
  }
}
