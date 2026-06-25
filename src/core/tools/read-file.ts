import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import type { Tool } from "./types.js";

// Line bounds are coerced because the emulated tool path delivers every arg as a
// string; native callers pass real numbers and coerce is a no-op for them.
const Args = z.object({
  path: z.string().min(1),
  start_line: z.coerce.number().int().min(1).optional(),
  end_line: z.coerce.number().int().min(1).optional(),
});
const MAX_CHARS = 60_000;

export const readFileTool: Tool = {
  mutating: false,
  spec: {
    name: "read_file",
    description:
      "Read the contents of a file in the workspace. Optionally pass start_line and/or end_line " +
      "(1-based, inclusive) to read only a slice of a large file instead of the whole thing.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Workspace-relative file path" },
        start_line: { type: "number", description: "First line to read (1-based, inclusive). Optional." },
        end_line: { type: "number", description: "Last line to read (1-based, inclusive). Optional." },
      },
      required: ["path"],
    },
  },
  async run(rawArgs, ctx) {
    const args = Args.safeParse(rawArgs);
    if (!args.success) return { ok: false, output: "Invalid args: 'path' is required (start_line/end_line must be positive integers)." };
    const { path, start_line, end_line } = args.data;

    if (start_line !== undefined && end_line !== undefined && start_line > end_line) {
      return { ok: false, output: `Invalid range: start_line (${start_line}) is after end_line (${end_line}).` };
    }

    const decision = ctx.permissions.authorizeRead(path);
    if (!decision.allowed) return { ok: false, output: `Read denied: ${decision.reason}` };

    try {
      const content = await readFile(resolve(ctx.workspace, path), "utf8");

      // No range requested → preserve the original whole-file behavior exactly.
      if (start_line === undefined && end_line === undefined) {
        const truncated = content.length > MAX_CHARS;
        return { ok: true, output: truncated ? content.slice(0, MAX_CHARS) + "\n…[truncated]" : content };
      }

      const lines = content.split("\n");
      const total = lines.length;
      // Clamp the requested window to the file's actual bounds.
      const from = Math.max(1, start_line ?? 1);
      const to = Math.min(total, end_line ?? total);
      if (from > total) {
        return { ok: false, output: `start_line ${from} is past the end of the file (${total} lines).` };
      }

      // Prefix each line with its real number so the model can target later edits.
      const width = String(to).length;
      const slice = lines
        .slice(from - 1, to)
        .map((l, i) => `${String(from + i).padStart(width)}| ${l}`)
        .join("\n");
      const body = slice.length > MAX_CHARS ? slice.slice(0, MAX_CHARS) + "\n…[truncated]" : slice;
      return { ok: true, output: `${body}\n(lines ${from}-${to} of ${total})` };
    } catch (err) {
      return { ok: false, output: `Could not read file: ${(err as Error).message}` };
    }
  },
};
