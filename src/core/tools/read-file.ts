import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import type { Tool } from "./types.js";

const Args = z.object({ path: z.string().min(1) });
const MAX_CHARS = 60_000;

export const readFileTool: Tool = {
  mutating: false,
  spec: {
    name: "read_file",
    description: "Read the contents of a file in the workspace.",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "Workspace-relative file path" } },
      required: ["path"],
    },
  },
  async run(rawArgs, ctx) {
    const args = Args.safeParse(rawArgs);
    if (!args.success) return { ok: false, output: "Invalid args: 'path' is required." };

    const decision = ctx.permissions.authorizeRead(args.data.path);
    if (!decision.allowed) return { ok: false, output: `Read denied: ${decision.reason}` };

    try {
      const content = await readFile(resolve(ctx.workspace, args.data.path), "utf8");
      const truncated = content.length > MAX_CHARS;
      return {
        ok: true,
        output: (truncated ? content.slice(0, MAX_CHARS) + "\n…[truncated]" : content),
      };
    } catch (err) {
      return { ok: false, output: `Could not read file: ${(err as Error).message}` };
    }
  },
};
