import { exec } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import type { Tool } from "./types.js";

const execAsync = promisify(exec);
const MAX_OUTPUT = 20_000;

const CustomToolSchema = z.object({
  name: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/i, "tool name must be alphanumeric/underscore"),
  description: z.string().min(1),
  /** JSON-schema object for the tool parameters (advertised to the model). */
  parameters: z.record(z.unknown()).optional(),
  /** Shell command template; `{argName}` placeholders are filled from the call arguments. */
  command: z.string().min(1),
});

export type CustomToolDef = z.infer<typeof CustomToolSchema>;

/** Build an executable Tool from a declarative definition. Runs through the permission engine. */
export function makeCommandTool(def: CustomToolDef): Tool {
  return {
    mutating: true,
    spec: {
      name: def.name,
      description: def.description,
      parameters: (def.parameters as Record<string, unknown>) ?? { type: "object", properties: {} },
    },
    async run(rawArgs, ctx) {
      const command = fillTemplate(def.command, rawArgs);
      const decision = await ctx.permissions.authorizeCommand(command);
      if (!decision.allowed) return { ok: false, output: `Command denied: ${decision.reason}` };
      try {
        const { stdout, stderr } = await execAsync(command, {
          cwd: ctx.workspace,
          timeout: 120_000,
          maxBuffer: 10 * 1024 * 1024,
          windowsHide: true,
        });
        return { ok: true, output: clamp(`${stdout}${stderr ? `\n[stderr]\n${stderr}` : ""}`.trim() || "(no output)") };
      } catch (err) {
        const e = err as { stdout?: string; stderr?: string; message: string; code?: number };
        return {
          ok: false,
          output: clamp(`Command failed (exit ${e.code ?? "?"}): ${e.message}\n${e.stdout ?? ""}${e.stderr ?? ""}`),
        };
      }
    },
  };
}

/** Load custom tools declared in `.poly/tools/*.json`. Invalid files are skipped. */
export async function loadCustomTools(workspace: string): Promise<Tool[]> {
  let files: string[];
  try {
    files = (await readdir(join(workspace, ".poly", "tools"))).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const tools: Tool[] = [];
  for (const f of files) {
    try {
      const raw = await readFile(join(workspace, ".poly", "tools", f), "utf8");
      const parsed = CustomToolSchema.safeParse(JSON.parse(raw));
      if (parsed.success) tools.push(makeCommandTool(parsed.data));
    } catch {
      /* skip malformed tool file */
    }
  }
  return tools;
}

/** Replace `{arg}` placeholders with the matching string argument values. */
function fillTemplate(template: string, args: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = args[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

function clamp(s: string): string {
  return s.length > MAX_OUTPUT ? s.slice(0, MAX_OUTPUT) + "\n…[truncated]" : s;
}
