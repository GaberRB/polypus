import { lstat, readdir, rmdir, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import type { Tool } from "./types.js";

const Args = z.object({ path: z.string().min(1) });

export const deleteFileTool: Tool = {
  mutating: true,
  spec: {
    name: "delete_file",
    description:
      "Delete a file, or an EMPTY directory, in the workspace. Refuses non-empty directories — delete their " +
      "contents first. Subject to the same allow/deny-list as writes.",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "Workspace-relative path to delete" } },
      required: ["path"],
    },
  },
  async run(rawArgs, ctx) {
    const args = Args.safeParse(rawArgs);
    if (!args.success) return { ok: false, output: "Invalid args: 'path' is required." };

    // A delete mutates the path, so gate it like a write (allow/deny-list + mode).
    const decision = await ctx.permissions.authorizeWrite(args.data.path);
    if (!decision.allowed) return { ok: false, output: `Delete denied: ${decision.reason}` };

    try {
      const abs = resolve(ctx.workspace, args.data.path);
      const st = await lstat(abs);
      if (st.isDirectory()) {
        // Never recurse — refuse a populated directory instead of nuking its tree.
        if ((await readdir(abs)).length > 0) {
          return { ok: false, output: `Refused: '${args.data.path}' is a non-empty directory. Delete its contents first.` };
        }
        await rmdir(abs);
        return { ok: true, output: `Deleted empty directory ${args.data.path}.` };
      }
      await unlink(abs);
      return { ok: true, output: `Deleted ${args.data.path}.` };
    } catch (err) {
      return { ok: false, output: `Could not delete: ${(err as Error).message}` };
    }
  },
};
