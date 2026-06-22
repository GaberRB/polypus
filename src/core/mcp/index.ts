import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { Tool } from "../tools/types.js";
import { McpClient } from "./client.js";

const ServerSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).default({}),
});
const McpConfigSchema = z.object({
  mcpServers: z.record(ServerSchema).default({}),
});

export type McpServerConfig = z.infer<typeof ServerSchema>;

const MAX_OUTPUT = 20_000;

export interface LoadedMcp {
  /** External tools, namespaced `mcp__<server>__<tool>`, ready for the agent loop. */
  tools: Tool[];
  /** Server names that connected. */
  servers: string[];
  /** Shut down every spawned MCP server. */
  close: () => Promise<void>;
}

/**
 * Load and connect the MCP servers declared in `.poly/mcp.json`, returning their
 * tools wrapped as Polypus tools. Servers that fail to start are skipped (never
 * throws). Tool names are namespaced to avoid clashes with built-ins/each other.
 */
export async function loadMcpTools(workspace: string): Promise<LoadedMcp> {
  let raw: string;
  try {
    raw = await readFile(join(workspace, ".poly", "mcp.json"), "utf8");
  } catch {
    return { tools: [], servers: [], close: async () => {} };
  }
  const parsed = McpConfigSchema.safeParse(safeJson(raw));
  if (!parsed.success) return { tools: [], servers: [], close: async () => {} };

  const clients: McpClient[] = [];
  const tools: Tool[] = [];
  const servers: string[] = [];

  for (const [name, cfg] of Object.entries(parsed.data.mcpServers)) {
    const client = new McpClient(cfg.command, cfg.args, cfg.env);
    try {
      await client.initialize();
      const defs = await client.listTools();
      for (const def of defs) tools.push(wrapTool(name, client, def.name, def.description, def.inputSchema));
      clients.push(client);
      servers.push(name);
    } catch {
      await client.close().catch(() => {});
    }
  }

  return {
    tools,
    servers,
    close: async () => {
      await Promise.all(clients.map((c) => c.close().catch(() => {})));
    },
  };
}

function wrapTool(
  server: string,
  client: McpClient,
  toolName: string,
  description: string | undefined,
  inputSchema: Record<string, unknown> | undefined,
): Tool {
  return {
    mutating: true,
    spec: {
      name: `mcp__${server}__${toolName}`,
      description: `[MCP:${server}] ${description ?? toolName}`,
      parameters: inputSchema ?? { type: "object", properties: {} },
    },
    async run(args, ctx) {
      // External MCP tools can have side effects; disable them in read-only plan mode.
      if (ctx.permissions.mode === "plan") {
        return { ok: false, output: "plan mode: external MCP tools are disabled" };
      }
      const { ok, text } = await client.callTool(toolName, args);
      return { ok, output: text.length > MAX_OUTPUT ? text.slice(0, MAX_OUTPUT) + "\n…[truncated]" : text };
    },
  };
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
