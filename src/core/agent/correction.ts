import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Provider, ToolCall, ToolSpec } from "../providers/types.js";

/**
 * Auto-correction layer. When a tool call fails, the raw error is often too
 * terse for the model to recover from, so it keeps re-issuing the same broken
 * call until the loop stalls. `buildCorrection` turns that failure into an
 * instructive message: it explains the likely cause AND attaches the missing
 * context (e.g. the real file contents for an edit that did not match) so the
 * model can fix its own call on the next step.
 *
 * Strategy is hybrid: deterministic rules handle the common, recognizable
 * failures cheaply; anything unrecognized may escalate to a single "fixer" LLM
 * call (provided by the caller) to produce guidance.
 */

/** Escalation hook: a secondary LLM call that diagnoses an unrecognized error. */
export type Escalator = (info: {
  call: ToolCall;
  output: string;
  toolSpec?: ToolSpec;
}) => Promise<string | null>;

export interface CorrectionDeps {
  workspace: string;
  /** Editable glob allow-list (from the prompt context). */
  allow: string[];
  /** Spec of the tool that failed, used to restate its schema on bad args. */
  toolSpec?: ToolSpec;
  /** The model's response was cut off at the token limit (finishReason length/max_tokens). */
  truncated?: boolean;
  /** Optional LLM fixer, invoked only when no deterministic rule matches. */
  escalate?: Escalator;
}

/**
 * Guidance for a response that hit the output token limit. The most common
 * real-world cause of a `write_file` failing with only `path` (Issue #25): the
 * model emitted a huge file, got cut off mid tool-call, and `content` never
 * arrived. Telling it to split the file is what actually breaks the loop.
 */
export function truncationGuidance(toolName?: string): string {
  const fileHint =
    toolName === "write_file" || toolName === "edit_file"
      ? " Write large files in parts: create the file with the first chunk via write_file, then append the rest with edit_file in the next steps."
      : "";
  return [
    "AUTO-CORRECTION — your previous response was cut off at the output token limit,",
    "so the tool call was incomplete (e.g. 'content' missing or partial).",
    "Do NOT resend the same large output — produce a smaller one this time." + fileHint,
  ].join("\n");
}

/**
 * Build corrective guidance to append to a failed tool result, or `null` when
 * there is nothing useful to add. Never replaces the original error — the loop
 * appends this so the model sees both.
 */
export async function buildCorrection(
  call: ToolCall,
  output: string,
  deps: CorrectionDeps,
): Promise<string | null> {
  const deterministic = await deterministicCorrection(call, output, deps);
  if (deterministic) return deterministic;
  if (deps.escalate) return deps.escalate({ call, output, toolSpec: deps.toolSpec });
  return null;
}

async function deterministicCorrection(
  call: ToolCall,
  output: string,
  deps: CorrectionDeps,
): Promise<string | null> {
  // Truncation takes priority: a failed call after a cut-off response is almost
  // always the cause, and restating the schema (below) would just loop.
  if (deps.truncated) return truncationGuidance(call.name);

  const path = typeof call.arguments.path === "string" ? call.arguments.path : undefined;

  // edit_file: the 'search' snippet was not found in the file.
  if (call.name === "edit_file" && /was not found/i.test(output) && path) {
    const search = typeof call.arguments.search === "string" ? call.arguments.search : "";
    const snippet = await snippetNearSearch(deps.workspace, path, search);
    if (snippet) {
      return [
        "AUTO-CORRECTION — the 'search' text does not exist verbatim in the file.",
        "Here is the file's actual content (line-numbered). Copy the 'search' value EXACTLY",
        "from these lines (including indentation and whitespace), then resend edit_file:",
        "",
        snippet,
      ].join("\n");
    }
  }

  // edit_file: the 'search' snippet matched more than once.
  if (call.name === "edit_file" && /matched \d+ times/i.test(output) && path) {
    const search = typeof call.arguments.search === "string" ? call.arguments.search : "";
    const lines = await occurrenceLines(deps.workspace, path, search);
    if (lines.length > 0) {
      return [
        "AUTO-CORRECTION — the 'search' text is not unique; it appears at lines " +
          `${lines.join(", ")}.`,
        "Add more surrounding lines to 'search' so it matches exactly one location, then resend.",
      ].join("\n");
    }
  }

  // Missing file or parent directory (ENOENT) on read or write.
  if (/ENOENT|no such file/i.test(output) && path) {
    const listing = await listNearest(deps.workspace, path);
    if (listing) {
      return [
        "AUTO-CORRECTION — that path does not exist. Nearby existing entries:",
        "",
        listing,
        "",
        "Use list_dir to confirm the correct path, or create the parent directory first.",
      ].join("\n");
    }
  }

  // Permission denied: the path is outside the editable allow-list.
  if (/denied|not allowed/i.test(output)) {
    return [
      "AUTO-CORRECTION — this action was blocked by the permission policy.",
      `Editable paths (glob allow-list): ${deps.allow.join(", ") || "(none)"}.`,
      "Target a path inside the allow-list, or stop and report that the change is out of scope.",
    ].join("\n");
  }

  // Unknown tool: the model invented a tool name or mistyped one. The raw error
  // already lists the valid names; nudge it to use them verbatim.
  if (/unknown tool/i.test(output)) {
    return [
      "AUTO-CORRECTION — you called a tool that does not exist.",
      "Use ONLY the tools listed in your instructions, with their exact names",
      "(they are case-sensitive and shown in the error above).",
    ].join("\n");
  }

  // Invalid / missing arguments: restate the exact schema of the tool.
  if (deps.toolSpec && /needs .* arguments|Invalid|required|Resend the tool call/i.test(output)) {
    return [
      "AUTO-CORRECTION — the call had missing or invalid arguments. Expected schema:",
      "",
      formatSchema(deps.toolSpec),
      "",
      "Resend the tool call with every required argument filled in.",
    ].join("\n");
  }

  return null;
}

/** A single LLM fixer call. Returns plain corrective guidance, or null. */
export function makeLLMEscalator(provider: Provider): Escalator {
  return async ({ call, output, toolSpec }) => {
    const prompt = [
      "A tool call just failed. Diagnose WHY in one or two sentences, then give a concrete,",
      "actionable instruction for how to correct the call. Do not apologize and do not call any tool.",
      "",
      `Tool: ${call.name}`,
      `Arguments: ${JSON.stringify(call.arguments)}`,
      `Error: ${output}`,
      toolSpec ? `Schema: ${JSON.stringify(toolSpec.parameters)}` : "",
    ].join("\n");
    try {
      const res = await provider.chat({
        messages: [
          { role: "system", content: "You are a debugging assistant for an autonomous coding agent." },
          { role: "user", content: prompt },
        ],
        params: { maxTokens: 400 },
      });
      const text = res.content.trim();
      return text ? `AUTO-CORRECTION (diagnosis):\n${text}` : null;
    } catch {
      return null;
    }
  };
}

// ---------------------------------------------------------------------------
// helpers

async function readWorkspaceFile(workspace: string, path: string): Promise<string | null> {
  try {
    return await readFile(resolve(workspace, path), "utf8");
  } catch {
    return null;
  }
}

/** Number lines 1-based and keep a window around `center` (0-based line index). */
function numberedWindow(content: string, center: number, radius: number): string {
  const lines = content.split("\n");
  const start = Math.max(0, center - radius);
  const end = Math.min(lines.length, center + radius + 1);
  const width = String(end).length;
  return lines
    .slice(start, end)
    .map((line, i) => `${String(start + i + 1).padStart(width, " ")} | ${line}`)
    .join("\n");
}

/** Show file content around the line that best matches the failed 'search'. */
async function snippetNearSearch(
  workspace: string,
  path: string,
  search: string,
): Promise<string | null> {
  const content = await readWorkspaceFile(workspace, path);
  if (content === null) return null;
  const lines = content.split("\n");
  const anchor = bestAnchorLine(lines, search);
  return numberedWindow(content, anchor >= 0 ? anchor : 0, 6);
}

/** Pick the file line that shares the most words with the search's first real line. */
function bestAnchorLine(lines: string[], search: string): number {
  const target = search.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
  if (!target) return -1;
  const targetWords = new Set(tokens(target));
  let best = -1;
  let bestScore = 0;
  lines.forEach((line, i) => {
    if (line.includes(target)) {
      if (bestScore < Number.MAX_SAFE_INTEGER) {
        best = i;
        bestScore = Number.MAX_SAFE_INTEGER;
      }
      return;
    }
    const score = tokens(line).filter((w) => targetWords.has(w)).length;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  });
  return best;
}

function tokens(s: string): string[] {
  return s.split(/\W+/).filter((w) => w.length > 0);
}

/** 1-based line numbers where `search` starts inside the file. */
async function occurrenceLines(workspace: string, path: string, search: string): Promise<number[]> {
  const content = await readWorkspaceFile(workspace, path);
  if (content === null || search.length === 0) return [];
  const out: number[] = [];
  let from = 0;
  for (;;) {
    const idx = content.indexOf(search, from);
    if (idx === -1) break;
    out.push(content.slice(0, idx).split("\n").length);
    from = idx + search.length;
  }
  return out;
}

/** List the contents of the nearest existing ancestor directory of `path`. */
async function listNearest(workspace: string, path: string): Promise<string | null> {
  let dir = dirname(resolve(workspace, path));
  for (let i = 0; i < 8; i++) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      const rel = dir === resolve(workspace) ? "." : dir;
      const names = entries.slice(0, 40).map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
      return `${rel}:\n  ${names.join("  ") || "(empty)"}`;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) return null;
      dir = parent;
    }
  }
  return null;
}

/** Render a tool's JSON-schema parameters as a readable required/optional list. */
function formatSchema(spec: ToolSpec): string {
  const props =
    (spec.parameters as { properties?: Record<string, { type?: string; description?: string }> }).properties ?? {};
  const required = new Set((spec.parameters as { required?: string[] }).required ?? []);
  const lines = Object.entries(props).map(
    ([name, v]) =>
      `  - ${name} (${v.type ?? "any"}, ${required.has(name) ? "required" : "optional"})` +
      (v.description ? `: ${v.description}` : ""),
  );
  return lines.join("\n") || "  (no parameters)";
}
