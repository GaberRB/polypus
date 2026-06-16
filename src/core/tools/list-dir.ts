import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import type { Tool } from "./types.js";

const Args = z.object({ path: z.string().default(".") });

export const listDirTool: Tool = {
  mutating: false,
  spec: {
    name: "list_dir",
    description: "List files and subdirectories of a workspace directory.",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "Workspace-relative directory (default '.')" } },
    },
  },
  async run(rawArgs, ctx) {
    const args = Args.safeParse(rawArgs);
    const path = args.success ? args.data.path : ".";

    const decision = ctx.permissions.authorizeRead(path === "." ? "." : path);
    // Listing the workspace root itself is always permitted.
    if (path !== "." && !decision.allowed) {
      return { ok: false, output: `List denied: ${decision.reason}` };
    }

    try {
      const entries = await readdir(resolve(ctx.workspace, path), { withFileTypes: true });
      const lines = entries
        .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
        .sort();
      return { ok: true, output: lines.length ? lines.join("\n") : "(empty)" };
    } catch (err) {
      return { ok: false, output: `Could not list directory: ${(err as Error).message}` };
    }
  },
};
