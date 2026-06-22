import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { McpClient } from "../src/core/mcp/client.js";
import { loadMcpTools } from "../src/core/mcp/index.js";
import { PermissionEngine } from "../src/core/permissions/modes.js";

// A tiny MCP server over stdio (newline-delimited JSON-RPC) used for tests.
const FAKE_SERVER = `
let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf("\\n")) !== -1) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.method === "initialize") {
      reply(msg.id, { protocolVersion: "2024-11-05", capabilities: {}, serverInfo: { name: "fake" } });
    } else if (msg.method === "tools/list") {
      reply(msg.id, { tools: [{ name: "echo", description: "echo back the message", inputSchema: { type: "object", properties: { msg: { type: "string" } }, required: ["msg"] } }] });
    } else if (msg.method === "tools/call") {
      reply(msg.id, { content: [{ type: "text", text: "echo: " + (msg.params.arguments.msg ?? "") }] });
    }
    // notifications (no id) get no response
  }
});
function reply(id, result) { process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\\n"); }
`;

const dirs: string[] = [];
function workspace(): string {
  const d = mkdtempSync(join(tmpdir(), "polypus-mcp-"));
  dirs.push(d);
  return d;
}
function writeServer(dir: string): string {
  const p = join(dir, "fake-server.mjs");
  writeFileSync(p, FAKE_SERVER);
  return p;
}

afterEach(() => {
  for (const d of dirs.splice(0)) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

describe("McpClient", () => {
  it("initializes, lists and calls a tool over stdio", async () => {
    const ws = workspace();
    const server = writeServer(ws);
    const client = new McpClient(process.execPath, [server]);
    await client.initialize();
    const tools = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(["echo"]);
    const res = await client.callTool("echo", { msg: "hi" });
    expect(res.ok).toBe(true);
    expect(res.text).toBe("echo: hi");
    await client.close();
  });
});

describe("loadMcpTools", () => {
  it("wraps a configured server's tools as namespaced Polypus tools", async () => {
    const ws = workspace();
    const server = writeServer(ws);
    mkdirSync(join(ws, ".poly"), { recursive: true });
    writeFileSync(
      join(ws, ".poly", "mcp.json"),
      JSON.stringify({ mcpServers: { demo: { command: process.execPath, args: [server] } } }),
    );

    const mcp = await loadMcpTools(ws);
    try {
      expect(mcp.servers).toEqual(["demo"]);
      expect(mcp.tools.map((t) => t.spec.name)).toEqual(["mcp__demo__echo"]);

      const bypass = new PermissionEngine({ mode: "bypass", policy: { workspace: ws, allow: ["**/*"], deny: [] }, allowedCommands: [] });
      const out = await mcp.tools[0]!.run({ msg: "world" }, { workspace: ws, permissions: bypass });
      expect(out.ok).toBe(true);
      expect(out.output).toBe("echo: world");

      // plan mode disables external MCP tools
      const plan = new PermissionEngine({ mode: "plan", policy: { workspace: ws, allow: ["**/*"], deny: [] }, allowedCommands: [] });
      const denied = await mcp.tools[0]!.run({ msg: "x" }, { workspace: ws, permissions: plan });
      expect(denied.ok).toBe(false);
      expect(denied.output).toMatch(/plan mode/);
    } finally {
      await mcp.close();
    }
  });

  it("returns nothing when there is no .poly/mcp.json", async () => {
    const mcp = await loadMcpTools(workspace());
    expect(mcp.tools).toEqual([]);
    expect(mcp.servers).toEqual([]);
    await mcp.close();
  });
});
