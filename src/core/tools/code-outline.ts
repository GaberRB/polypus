import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { z } from "zod";
import type { Tool } from "./types.js";

const Args = z.object({ path: z.string().min(1) });
const TS_JS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"]);

export interface OutlineSymbol {
  kind: string;
  name: string;
  line: number;
}

export const codeOutlineTool: Tool = {
  mutating: false,
  spec: {
    name: "code_outline",
    description:
      "List the top-level symbols (functions, classes, interfaces, types, enums, exported consts) of a " +
      "TypeScript/JavaScript file with their line numbers — a quick map of a file without reading all of " +
      "it. Approximate (regex-based) and TS/JS only.",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "Workspace-relative .ts/.tsx/.js/.jsx file" } },
      required: ["path"],
    },
  },
  async run(rawArgs, ctx) {
    const args = Args.safeParse(rawArgs);
    if (!args.success) return { ok: false, output: "Invalid args: 'path' is required." };

    if (!TS_JS.has(extname(args.data.path).toLowerCase())) {
      return { ok: false, output: "code_outline supports TypeScript/JavaScript files only (.ts/.tsx/.js/.jsx)." };
    }

    const decision = ctx.permissions.authorizeRead(args.data.path);
    if (!decision.allowed) return { ok: false, output: `Read denied: ${decision.reason}` };

    let content: string;
    try {
      content = await readFile(resolve(ctx.workspace, args.data.path), "utf8");
    } catch (err) {
      return { ok: false, output: `Could not read file: ${(err as Error).message}` };
    }

    const symbols = outlineTsJs(content);
    if (symbols.length === 0) return { ok: true, output: "(no top-level symbols found)" };
    return { ok: true, output: symbols.map((s) => `${s.line}: ${s.kind} ${s.name}`).join("\n") };
  },
};

// Keyword declarations, anchored at the start of a line (top-level only), allowing
// the usual leading modifiers. Approximate by design — this is navigation, not a parser.
const MODS = "(?:export\\s+)?(?:default\\s+)?(?:declare\\s+)?(?:abstract\\s+)?";
const RULES: { kind: string; re: RegExp }[] = [
  { kind: "function", re: new RegExp(`^${MODS}(?:async\\s+)?function\\*?\\s+([A-Za-z_$][\\w$]*)`) },
  { kind: "class", re: new RegExp(`^${MODS}class\\s+([A-Za-z_$][\\w$]*)`) },
  { kind: "interface", re: new RegExp(`^${MODS}interface\\s+([A-Za-z_$][\\w$]*)`) },
  { kind: "type", re: new RegExp(`^${MODS}type\\s+([A-Za-z_$][\\w$]*)\\s*[=<]`) },
  { kind: "enum", re: new RegExp(`^${MODS}(?:const\\s+)?enum\\s+([A-Za-z_$][\\w$]*)`) },
];
// A const/let/var bound to a function (arrow or function expression).
const FUNC_CONST = new RegExp(`^${MODS}(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\b`);

/** Extract top-level symbols from TS/JS source via line-anchored regexes. */
export function outlineTsJs(content: string): OutlineSymbol[] {
  const out: OutlineSymbol[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    // Top-level only: no leading indentation (members of a class/function are skipped).
    if (/^\s/.test(line)) continue;

    let matched = false;
    for (const { kind, re } of RULES) {
      const m = line.match(re);
      if (m) {
        out.push({ kind, name: m[1]!, line: i + 1 });
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // const foo = (...) => ... | const foo = async (...) => | const foo = function
    const fc = line.match(FUNC_CONST);
    if (fc && /=\s*(?:async\s+)?(?:function\b|\(|<|[A-Za-z_$][\w$]*\s*=>)/.test(line)) {
      out.push({ kind: "const", name: fc[1]!, line: i + 1 });
    }
  }
  return out;
}
