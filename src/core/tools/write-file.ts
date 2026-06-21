import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import type { Tool } from "./types.js";

const Args = z.object({ path: z.string().min(1), content: z.string() });

export const writeFileTool: Tool = {
  mutating: true,
  spec: {
    name: "write_file",
    description: "Create or overwrite a file with the given content.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Workspace-relative file path" },
        content: { type: "string", description: "Full file content" },
      },
      required: ["path", "content"],
    },
  },
  async run(rawArgs, ctx) {
    const args = Args.safeParse(rawArgs);
    if (!args.success) {
      const got = Object.keys(rawArgs ?? {});
      return {
        ok: false,
        output:
          "write_file needs two arguments: 'path' (the file path) and 'content' (the complete file text). " +
          `Received: [${got.join(", ") || "none"}]. Resend the tool call with BOTH arguments filled in, ` +
          "and keep the file small enough to fit in one message.",
      };
    }

    const preview = previewContent(args.data.content);
    const decision = await ctx.permissions.authorizeWrite(args.data.path, preview, args.data.content);
    if (!decision.allowed) return { ok: false, output: `Write denied: ${decision.reason}` };

    try {
      const abs = resolve(ctx.workspace, args.data.path);
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, args.data.content, "utf8");
      const lines = args.data.content.split("\n").length;
      return { ok: true, output: `Wrote ${args.data.path} (${lines} lines).` };
    } catch (err) {
      return { ok: false, output: `Could not write file: ${(err as Error).message}` };
    }
  },
};

function previewContent(content: string): string {
  const lines = content.split("\n");
  return lines.length > 40 ? lines.slice(0, 40).join("\n") + "\n…" : content;
}
