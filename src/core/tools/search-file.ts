import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import { globToRegExp, toPosix } from "../permissions/allowlist.js";
import type { Tool } from "./types.js";

const Args = z.object({
  query: z.string().min(1),
  path: z.string().optional(),
  glob: z.string().optional(),
  max_results: z.number().int().positive().max(1000).optional(),
});

const DEFAULT_MAX_RESULTS = 50;
const MAX_OUTPUT = 20_000;
const MAX_FILE_BYTES = 2_000_000; // skip very large files
const SNIPPET_CHARS = 200;
const NUL = String.fromCharCode(0);
/** Directories never worth walking (large, machine-generated, or VCS internals). */
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".next", "coverage", ".turbo"]);

export const searchTool: Tool = {
  mutating: false,
  spec: {
    name: "search",
    description:
      "Search file contents by regular expression across the workspace (like grep/ripgrep). " +
      "Returns matches as 'path:line: snippet'. Respects the allow/deny-list and skips " +
      "node_modules/.git. Use this to find where a symbol is defined or used instead of " +
      "reading files blindly.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Regular expression to match against each line" },
        path: { type: "string", description: "Workspace-relative directory to search in (default '.')" },
        glob: {
          type: "string",
          description: "Optional glob to limit files, e.g. 'src/**/*.ts'",
        },
        max_results: {
          type: "number",
          description: `Maximum number of matches to return (default ${DEFAULT_MAX_RESULTS})`,
        },
      },
      required: ["query"],
    },
  },
  async run(rawArgs, ctx) {
    const parsed = Args.safeParse(rawArgs);
    if (!parsed.success) return { ok: false, output: "Invalid args: 'query' is required." };
    const { query, path = ".", glob, max_results } = parsed.data;

    let regex: RegExp;
    try {
      regex = new RegExp(query);
    } catch (err) {
      return { ok: false, output: `Invalid regular expression: ${(err as Error).message}` };
    }

    // The search root may be the workspace itself ('.') or a subdirectory; the
    // subdirectory must pass the read allow-list.
    if (path !== ".") {
      const decision = ctx.permissions.authorizeRead(path);
      if (!decision.allowed) return { ok: false, output: `Search denied: ${decision.reason}` };
    }

    const globRe = glob ? globToRegExp(glob) : undefined;
    const limit = max_results ?? DEFAULT_MAX_RESULTS;
    const root = resolve(ctx.workspace, path);
    const matches: string[] = [];
    let truncated = false;

    const walk = async (dir: string): Promise<void> => {
      if (matches.length >= limit) return;
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return; // unreadable directory — skip
      }
      for (const entry of entries) {
        if (matches.length >= limit) return;
        const abs = join(dir, entry.name);
        const rel = toPosix(abs.slice(ctx.workspace.length + 1));
        if (entry.isDirectory()) {
          if (SKIP_DIRS.has(entry.name)) continue;
          await walk(abs);
          continue;
        }
        if (!entry.isFile()) continue;
        if (globRe && !globRe.test(rel)) continue;
        // Content exposure is gated by the same allow/deny-list as read_file.
        if (!ctx.permissions.authorizeRead(rel).allowed) continue;

        try {
          const info = await stat(abs);
          if (info.size > MAX_FILE_BYTES) continue;
          const content = await readFile(abs, "utf8");
          if (content.includes(NUL)) continue; // looks binary
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (matches.length >= limit) {
              truncated = true;
              return;
            }
            if (regex.test(lines[i]!)) {
              const snippet = lines[i]!.trim().slice(0, SNIPPET_CHARS);
              matches.push(`${rel}:${i + 1}: ${snippet}`);
            }
          }
        } catch {
          // unreadable / non-utf8 file — skip
        }
      }
    };

    await walk(root);

    if (matches.length === 0) {
      return { ok: true, output: `No matches for /${query}/${glob ? ` in ${glob}` : ""}.` };
    }
    const header = `${matches.length}${truncated ? "+" : ""} match(es) for /${query}/:`;
    const body = [header, ...matches].join("\n");
    return {
      ok: true,
      output: body.length > MAX_OUTPUT ? body.slice(0, MAX_OUTPUT) + "\n…[truncated]" : body,
    };
  },
};
