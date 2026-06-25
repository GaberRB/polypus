import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import { globToRegExp, toPosix } from "../permissions/allowlist.js";
import type { Tool } from "./types.js";

// max_results is coerced because the emulated tool path delivers args as strings.
const Args = z.object({
  glob: z.string().min(1),
  path: z.string().optional(),
  max_results: z.coerce.number().int().positive().max(5000).optional(),
});

const DEFAULT_MAX = 200;
const MAX_OUTPUT = 20_000;
/** Directories never worth walking — same set the search tool skips. */
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".next", "coverage", ".turbo"]);

export const findFilesTool: Tool = {
  mutating: false,
  spec: {
    name: "find_files",
    description:
      "List workspace files whose path matches a glob (e.g. 'src/**/*.test.ts') WITHOUT reading their " +
      "contents. Respects the allow/deny-list and skips node_modules/.git. Use this to discover files; " +
      "use search to grep their contents.",
    parameters: {
      type: "object",
      properties: {
        glob: { type: "string", description: "Glob matched against workspace-relative paths, e.g. 'src/**/*.ts'" },
        path: { type: "string", description: "Workspace-relative directory to search in (default '.')" },
        max_results: { type: "number", description: `Maximum number of paths to return (default ${DEFAULT_MAX})` },
      },
      required: ["glob"],
    },
  },
  async run(rawArgs, ctx) {
    const parsed = Args.safeParse(rawArgs);
    if (!parsed.success) return { ok: false, output: "Invalid args: 'glob' is required." };
    const { glob, path = ".", max_results } = parsed.data;

    if (path !== ".") {
      const decision = ctx.permissions.authorizeRead(path);
      if (!decision.allowed) return { ok: false, output: `Find denied: ${decision.reason}` };
    }

    const globRe = globToRegExp(glob);
    const limit = max_results ?? DEFAULT_MAX;
    const root = resolve(ctx.workspace, path);
    const found: string[] = [];
    let truncated = false;

    const walk = async (dir: string): Promise<void> => {
      if (found.length >= limit) return;
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return; // unreadable directory — skip
      }
      for (const entry of entries) {
        if (found.length >= limit) {
          truncated = true;
          return;
        }
        const abs = join(dir, entry.name);
        const rel = toPosix(abs.slice(ctx.workspace.length + 1));
        if (entry.isDirectory()) {
          if (SKIP_DIRS.has(entry.name)) continue;
          await walk(abs);
          continue;
        }
        if (!entry.isFile()) continue;
        if (!globRe.test(rel)) continue;
        // Same allow/deny-list as reads — never reveal a denied path.
        if (!ctx.permissions.authorizeRead(rel).allowed) continue;
        found.push(rel);
      }
    };

    await walk(root);

    if (found.length === 0) return { ok: true, output: `No files match ${glob}.` };
    found.sort();
    const header = `${found.length}${truncated ? "+" : ""} file(s) matching ${glob}:`;
    const body = [header, ...found].join("\n");
    return { ok: true, output: body.length > MAX_OUTPUT ? body.slice(0, MAX_OUTPUT) + "\n…[truncated]" : body };
  },
};
