import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import type { Tool } from "./types.js";
import { safeFetch, DEFAULT_MAX_BYTES } from "../net/safe-fetch.js";

const Args = z.object({
  url: z.string().min(1),
  dest_path: z.string().min(1),
  max_bytes: z.coerce.number().int().min(1).max(100 * 1024 * 1024).optional(),
});
const DOWNLOAD_MAX_BYTES = 25 * 1024 * 1024; // 25 MB default cap for files

export const downloadTool: Tool = {
  mutating: true,
  spec: {
    name: "download",
    description:
      "Download a file from an https URL into the workspace. Both the URL (https-only, no private/internal hosts) " +
      "and the destination path (must stay inside the workspace) are permission-checked. Use for binaries/assets; " +
      "use web_fetch to read page text.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Absolute https URL of the file" },
        dest_path: { type: "string", description: "Workspace-relative destination path" },
        max_bytes: { type: "number", description: "Maximum download size in bytes (default 25 MB)" },
      },
      required: ["url", "dest_path"],
    },
  },
  async run(rawArgs, ctx) {
    const args = Args.safeParse(rawArgs);
    if (!args.success) return { ok: false, output: "Invalid args: 'url' and 'dest_path' are required." };

    // Consent + SSRF/https guard on the source, then path containment on the destination.
    const net = await ctx.permissions.authorizeNetwork(args.data.url);
    if (!net.allowed) return { ok: false, output: `Download denied: ${net.reason}` };
    const write = await ctx.permissions.authorizeWrite(args.data.dest_path);
    if (!write.allowed) return { ok: false, output: `Download denied: ${write.reason}` };

    const maxBytes = args.data.max_bytes ?? DOWNLOAD_MAX_BYTES;
    try {
      const res = await safeFetch(args.data.url, { maxBytes: Math.max(maxBytes, DEFAULT_MAX_BYTES) });
      if (res.status >= 400) return { ok: false, output: `Download failed: HTTP ${res.status} for ${res.url}` };

      const abs = resolve(ctx.workspace, args.data.dest_path);
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, res.body);
      return { ok: true, output: `Downloaded ${res.body.length} bytes to ${args.data.dest_path}.` };
    } catch (err) {
      return { ok: false, output: `Download failed: ${(err as Error).message}` };
    }
  },
};
