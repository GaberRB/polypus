import { lstat } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import type { Tool } from "./types.js";

const Args = z.object({ path: z.string().min(1) });

export const fileStatsTool: Tool = {
  mutating: false,
  spec: {
    name: "file_stats",
    description:
      "Get metadata for a workspace path (size in bytes, type, last-modified time) without reading its " +
      "contents — useful to decide whether to open a file or to check if a path is a file or directory.",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "Workspace-relative path" } },
      required: ["path"],
    },
  },
  async run(rawArgs, ctx) {
    const args = Args.safeParse(rawArgs);
    if (!args.success) return { ok: false, output: "Invalid args: 'path' is required." };

    const decision = ctx.permissions.authorizeRead(args.data.path);
    if (!decision.allowed) return { ok: false, output: `Read denied: ${decision.reason}` };

    try {
      // lstat, not stat: report on the path itself and never follow a symlink out
      // of the workspace.
      const s = await lstat(resolve(ctx.workspace, args.data.path));
      const info = {
        path: args.data.path,
        size: s.size,
        isFile: s.isFile(),
        isDir: s.isDirectory(),
        isSymlink: s.isSymbolicLink(),
        mtime: s.mtime.toISOString(),
      };
      return { ok: true, output: JSON.stringify(info) };
    } catch (err) {
      return { ok: false, output: `Could not stat path: ${(err as Error).message}` };
    }
  },
};
