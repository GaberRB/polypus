import { mkdir, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import type { Tool } from "./types.js";

const Args = z.object({ from: z.string().min(1), to: z.string().min(1) });

export const moveFileTool: Tool = {
  mutating: true,
  spec: {
    name: "move_file",
    description:
      "Move or rename a file or directory within the workspace. Creates the destination's parent directories " +
      "if needed. Subject to the same allow/deny-list as writes (both source and destination).",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string", description: "Workspace-relative source path" },
        to: { type: "string", description: "Workspace-relative destination path" },
      },
      required: ["from", "to"],
    },
  },
  async run(rawArgs, ctx) {
    const args = Args.safeParse(rawArgs);
    if (!args.success) return { ok: false, output: "Invalid args: 'from' and 'to' are required." };

    // Both ends change: the source is removed and the destination is created — gate both.
    const dFrom = await ctx.permissions.authorizeWrite(args.data.from);
    if (!dFrom.allowed) return { ok: false, output: `Move denied (source): ${dFrom.reason}` };
    const dTo = await ctx.permissions.authorizeWrite(args.data.to);
    if (!dTo.allowed) return { ok: false, output: `Move denied (destination): ${dTo.reason}` };

    try {
      const toAbs = resolve(ctx.workspace, args.data.to);
      await mkdir(dirname(toAbs), { recursive: true });
      await rename(resolve(ctx.workspace, args.data.from), toAbs);
      return { ok: true, output: `Moved ${args.data.from} → ${args.data.to}.` };
    } catch (err) {
      return { ok: false, output: `Could not move: ${(err as Error).message}` };
    }
  },
};
