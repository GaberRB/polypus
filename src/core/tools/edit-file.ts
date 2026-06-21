import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import type { Tool } from "./types.js";

const Args = z.object({
  path: z.string().min(1),
  search: z.string().min(1),
  replace: z.string(),
});

export const editFileTool: Tool = {
  mutating: true,
  spec: {
    name: "edit_file",
    description:
      "Replace an exact snippet in a file. 'search' must match the existing text verbatim and uniquely.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Workspace-relative file path" },
        search: { type: "string", description: "Exact text to find (must be unique in the file)" },
        replace: { type: "string", description: "Text to replace it with" },
      },
      required: ["path", "search", "replace"],
    },
  },
  async run(rawArgs, ctx) {
    const args = Args.safeParse(rawArgs);
    if (!args.success) {
      return {
        ok: false,
        output:
          "edit_file needs three arguments: 'path', 'search' (exact text to find), and 'replace'. " +
          "Resend the tool call with all three filled in.",
      };
    }

    const abs = resolve(ctx.workspace, args.data.path);
    let content: string;
    try {
      content = await readFile(abs, "utf8");
    } catch (err) {
      return { ok: false, output: `Could not read file to edit: ${(err as Error).message}` };
    }

    const occurrences = content.split(args.data.search).length - 1;
    if (occurrences === 0) {
      return { ok: false, output: "The 'search' text was not found. Re-read the file and try an exact snippet." };
    }
    if (occurrences > 1) {
      return {
        ok: false,
        output: `The 'search' text matched ${occurrences} times; it must be unique. Include more surrounding context.`,
      };
    }

    const updated = content.replace(args.data.search, args.data.replace);
    const decision = await ctx.permissions.authorizeWrite(
      args.data.path,
      `- ${firstLine(args.data.search)}\n+ ${firstLine(args.data.replace)}`,
      args.data.replace,
    );
    if (!decision.allowed) return { ok: false, output: `Edit denied: ${decision.reason}` };

    try {
      await writeFile(abs, updated, "utf8");
      return { ok: true, output: `Edited ${args.data.path}.` };
    } catch (err) {
      return { ok: false, output: `Could not write edit: ${(err as Error).message}` };
    }
  },
};

function firstLine(s: string): string {
  return s.split("\n")[0] ?? "";
}
