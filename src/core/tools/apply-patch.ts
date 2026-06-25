import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import type { Tool } from "./types.js";

const Args = z.object({ path: z.string().min(1), patch: z.string().min(1) });

export const applyPatchTool: Tool = {
  mutating: true,
  spec: {
    name: "apply_patch",
    description:
      "Apply a unified diff (the @@ hunk format produced by `git diff`) to a single workspace file. " +
      "Use this for multi-hunk edits in one shot; for a single literal replacement, edit_file is simpler. " +
      "The patch must apply cleanly — if a hunk doesn't match the current file, nothing is written.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Workspace-relative file to patch" },
        patch: { type: "string", description: "Unified diff body (hunks starting with '@@'); file headers are optional" },
      },
      required: ["path", "patch"],
    },
  },
  async run(rawArgs, ctx) {
    const args = Args.safeParse(rawArgs);
    if (!args.success) return { ok: false, output: "Invalid args: 'path' and 'patch' are required." };

    let original: string;
    try {
      original = await readFile(resolve(ctx.workspace, args.data.path), "utf8");
    } catch (err) {
      return { ok: false, output: `Could not read file to patch: ${(err as Error).message}` };
    }

    const applied = applyUnifiedDiff(original, args.data.patch);
    if (!applied.ok) return { ok: false, output: applied.error };

    // Gate as a write so the diff preview, secret scan and review/hunk approval all run.
    const preview = previewDiff(args.data.patch);
    const decision = await ctx.permissions.authorizeWrite(args.data.path, preview, applied.result);
    if (!decision.allowed) return { ok: false, output: `Write denied: ${decision.reason}` };

    const finalContent = decision.content ?? applied.result;
    try {
      await writeFile(resolve(ctx.workspace, args.data.path), finalContent, "utf8");
      return { ok: true, output: `Patched ${args.data.path} (${applied.hunks} hunk(s)).` };
    } catch (err) {
      return { ok: false, output: `Could not write patched file: ${(err as Error).message}` };
    }
  },
};

interface Hunk {
  oldStart: number; // 1-based line in the original; a hint, verified on apply
  oldLines: string[]; // context + removed lines, in order (what the hunk expects to find)
  newLines: string[]; // context + added lines, in order (what replaces them)
}

export interface ApplyResult {
  ok: true;
  result: string;
  hunks: number;
}
export interface ApplyError {
  ok: false;
  error: string;
}

/** Parse a unified diff into hunks. Header lines (---, +++, diff, index) are ignored. */
export function parseUnifiedDiff(patch: string): Hunk[] | { error: string } {
  const lines = patch.split("\n");
  const hunks: Hunk[] = [];
  let current: Hunk | null = null;

  for (const line of lines) {
    if (line.startsWith("@@")) {
      const m = line.match(/^@@ -(\d+)(?:,\d+)? \+\d+(?:,\d+)? @@/);
      if (!m) return { error: `Malformed hunk header: ${line}` };
      current = { oldStart: Number(m[1]), oldLines: [], newLines: [] };
      hunks.push(current);
      continue;
    }
    if (!current) continue; // preamble (file headers etc.) before the first hunk
    if (line.startsWith("\\")) continue; // "\ No newline at end of file"
    // A bare empty line is the artifact of a trailing newline (or a blank separator),
    // never a hunk body line — git represents a blank context line as " " (a space).
    if (line === "") continue;
    const tag = line[0];
    const text = line.slice(1);
    if (tag === " ") {
      current.oldLines.push(text);
      current.newLines.push(text);
    } else if (tag === "-") {
      current.oldLines.push(text);
    } else if (tag === "+") {
      current.newLines.push(text);
    } else {
      return { error: `Unexpected patch line: ${line}` };
    }
  }
  if (hunks.length === 0) return { error: "No hunks found in patch (expected '@@ ... @@' sections)." };
  return hunks;
}

/** Apply a unified diff to `original`, returning the new content or a clear error. */
export function applyUnifiedDiff(original: string, patch: string): ApplyResult | ApplyError {
  const parsed = parseUnifiedDiff(patch);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  const hadTrailingNewline = original.endsWith("\n");
  const src = original.split("\n");
  if (hadTrailingNewline) src.pop(); // drop the empty element after the final newline

  const out: string[] = [];
  let cursor = 0; // index into src already copied to out

  for (let h = 0; h < parsed.length; h++) {
    const hunk = parsed[h]!;
    const at = locateHunk(src, hunk, cursor);
    if (at < 0) {
      return { ok: false, error: `Hunk #${h + 1} did not match the file (expected near line ${hunk.oldStart}).` };
    }
    // Copy untouched lines before the hunk, then the hunk's replacement.
    for (let i = cursor; i < at; i++) out.push(src[i]!);
    out.push(...hunk.newLines);
    cursor = at + hunk.oldLines.length;
  }
  for (let i = cursor; i < src.length; i++) out.push(src[i]!);

  let result = out.join("\n");
  if (hadTrailingNewline) result += "\n";
  return { ok: true, result, hunks: parsed.length };
}

/**
 * Find where a hunk's old lines occur in `src` at or after `from`. Prefers the
 * declared oldStart, then falls back to scanning forward, so a patch generated
 * against a slightly shifted file still applies. Returns -1 if it doesn't match.
 */
function locateHunk(src: string[], hunk: Hunk, from: number): number {
  const block = hunk.oldLines;
  // Pure-insertion hunk (no context/removed lines): anchor at the declared position.
  if (block.length === 0) return Math.min(Math.max(hunk.oldStart - 1, from), src.length);

  const matchesAt = (start: number): boolean => {
    if (start < from || start + block.length > src.length) return false;
    for (let i = 0; i < block.length; i++) if (src[start + i] !== block[i]) return false;
    return true;
  };

  const hint = hunk.oldStart - 1;
  if (matchesAt(hint)) return hint;
  for (let s = from; s + block.length <= src.length; s++) {
    if (matchesAt(s)) return s;
  }
  return -1;
}

function previewDiff(patch: string): string {
  const lines = patch.split("\n");
  return lines.length > 40 ? lines.slice(0, 40).join("\n") + "\n…" : patch;
}
