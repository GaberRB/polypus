import { exec } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import type { ToolCall } from "../providers/types.js";

const execAsync = promisify(exec);
const DEFAULT_TIMEOUT = 120_000;
const DEFAULT_MAX_OUTPUT = 1_000;
const ABSOLUTE_MAX_OUTPUT = 8_000;

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const HookEventSchema = z.enum(["PreToolUse", "PostToolUse", "Stop"]);
export type HookEvent = z.infer<typeof HookEventSchema>;

const HookEntrySchema = z.object({
  event: HookEventSchema,
  /** Tool name(s) this hook applies to. Use "*" or omit for any tool. Not used for Stop. */
  on: z.union([z.string(), z.array(z.string())]).default("*"),
  command: z.string().min(1),
  /** Timeout in ms (default 120 000). */
  timeout: z.number().int().positive().default(DEFAULT_TIMEOUT),
  /** Max chars captured from stdout+stderr before truncation (default 1 000, max 8 000). */
  maxOutputChars: z.number().int().positive().max(ABSOLUTE_MAX_OUTPUT).default(DEFAULT_MAX_OUTPUT),
});
export type HookEntry = z.infer<typeof HookEntrySchema>;

const HooksSchema = z.object({
  hooks: z.array(HookEntrySchema).default([]),
  // Legacy fields — still supported but emit a deprecation warning at load time.
  afterWrite: z.string().optional(),
  afterEdit: z.string().optional(),
  afterTool: z.string().optional(),
  beforeCommand: z.object({ deny: z.array(z.string()).default([]) }).optional(),
});

export type HooksConfig = z.infer<typeof HooksSchema>;

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

/** Load `.poly/hooks.json` for a workspace, normalising legacy fields. */
export async function loadHooks(workspace: string): Promise<HooksConfig | undefined> {
  try {
    const raw = await readFile(join(workspace, ".poly", "hooks.json"), "utf8");
    const parsed = HooksSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return undefined;
    const cfg = parsed.data;
    if (cfg.afterWrite ?? cfg.afterEdit ?? cfg.afterTool ?? cfg.beforeCommand) {
      process.stderr.write(
        "[polypus] hooks.json: afterWrite/afterEdit/afterTool/beforeCommand são deprecated. " +
          "Use o campo `hooks` com event PostToolUse/PreToolUse. Veja docs/hooks.md\n",
      );
    }
    return cfg;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function matchesToolName(entry: HookEntry, toolName: string): boolean {
  const patterns = Array.isArray(entry.on) ? entry.on : [entry.on];
  return patterns.some((p) => p === "*" || p === toolName);
}

function getEntries(cfg: HooksConfig, event: HookEvent, toolName?: string): HookEntry[] {
  const entries = (cfg.hooks ?? []).filter((h) => {
    if (h.event !== event) return false;
    return toolName !== undefined ? matchesToolName(h, toolName) : true;
  });

  // Legacy shims: translate old fields into HookEntry objects.
  if (event === "PostToolUse" && toolName) {
    if (toolName === "write_file" && cfg.afterWrite) {
      entries.push(HookEntrySchema.parse({ event: "PostToolUse", on: "write_file", command: cfg.afterWrite }));
    }
    if (toolName === "edit_file" && cfg.afterEdit) {
      entries.push(HookEntrySchema.parse({ event: "PostToolUse", on: "edit_file", command: cfg.afterEdit }));
    }
    if (cfg.afterTool) {
      entries.push(HookEntrySchema.parse({ event: "PostToolUse", on: "*", command: cfg.afterTool }));
    }
  }
  return entries;
}

function substitute(template: string, call: ToolCall | null, workspace: string): string {
  const path = call && typeof call.arguments.path === "string" ? call.arguments.path : "";
  const tool = call?.name ?? "";
  return template
    .replace(/\{path\}/g, path)
    .replace(/\{tool\}/g, tool)
    .replace(/\{workspace\}/g, workspace);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n… [truncado: ${s.length - max} chars omitidos]`;
}

async function runEntry(entry: HookEntry, call: ToolCall | null, workspace: string): Promise<HookRunResult> {
  const command = substitute(entry.command, call, workspace);
  const max = entry.maxOutputChars;
  const start = Date.now();
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: workspace,
      timeout: entry.timeout,
      windowsHide: true,
    });
    const raw = [stdout, stderr].filter(Boolean).join("\n").trim();
    return { command, durationMs: Date.now() - start, output: truncate(raw, max), blocked: false };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const raw = [e.stdout, e.stderr].filter(Boolean).join("\n").trim() || (e.message ?? "hook failed");
    return { command, durationMs: Date.now() - start, output: truncate(raw, max), blocked: true };
  }
}

// ---------------------------------------------------------------------------
// Public result type
// ---------------------------------------------------------------------------

export interface HookRunResult {
  /** The resolved shell command that was executed. */
  command: string;
  durationMs: number;
  /** Truncated stdout+stderr from the hook script. */
  output: string;
  /** true when the hook exited non-zero (PreToolUse → blocks the tool; PostToolUse → logged). */
  blocked: boolean;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * PreToolUse: run hooks before a tool executes.
 * Returns on the first blocking result — callers should abort tool execution.
 */
export async function runPreToolUseHooks(
  cfg: HooksConfig | undefined,
  call: ToolCall,
  workspace: string,
): Promise<HookRunResult[]> {
  const results: HookRunResult[] = [];

  // Legacy: beforeCommand deny-list.
  if (cfg?.beforeCommand?.deny && call.name === "run_command") {
    const cmd = String(call.arguments.command ?? "");
    for (const needle of cfg.beforeCommand.deny) {
      if (needle && cmd.includes(needle)) {
        results.push({
          command: "(deny-list)",
          durationMs: 0,
          output: `Command blocked by deny rule: "${needle}"`,
          blocked: true,
        });
        return results;
      }
    }
  }

  if (!cfg) return results;
  for (const entry of getEntries(cfg, "PreToolUse", call.name)) {
    const res = await runEntry(entry, call, workspace);
    results.push(res);
    if (res.blocked) break; // stop on first block
  }
  return results;
}

/**
 * PostToolUse: run hooks after a successful tool call.
 * All matching hooks run in sequence; their combined output is returned.
 */
export async function runPostToolUseHooks(
  cfg: HooksConfig | undefined,
  call: ToolCall,
  workspace: string,
): Promise<HookRunResult[]> {
  if (!cfg) return [];
  const entries = getEntries(cfg, "PostToolUse", call.name);
  const results: HookRunResult[] = [];
  for (const entry of entries) {
    results.push(await runEntry(entry, call, workspace));
  }
  return results;
}

/**
 * Stop: run hooks when the agent calls finish (no tool context).
 */
export async function runStopHooks(
  cfg: HooksConfig | undefined,
  workspace: string,
): Promise<HookRunResult[]> {
  if (!cfg) return [];
  const entries = getEntries(cfg, "Stop");
  const results: HookRunResult[] = [];
  for (const entry of entries) {
    results.push(await runEntry(entry, null, workspace));
  }
  return results;
}

// ---------------------------------------------------------------------------
// Deprecated — kept for backward compat with callers not yet migrated
// ---------------------------------------------------------------------------

/** @deprecated Use runPreToolUseHooks. */
export function screenCommandHook(
  hooks: HooksConfig | undefined,
  command: string,
): { blocked: boolean; reason?: string } {
  const deny = hooks?.beforeCommand?.deny ?? [];
  for (const needle of deny) {
    if (needle && command.includes(needle)) return { blocked: true, reason: `matches deny rule "${needle}"` };
  }
  return { blocked: false };
}

/** @deprecated Use runPostToolUseHooks. */
export async function runAfterHook(
  hooks: HooksConfig | undefined,
  call: ToolCall,
  workspace: string,
): Promise<string | undefined> {
  const results = await runPostToolUseHooks(hooks, call, workspace);
  if (results.length === 0) return undefined;
  return results.map((r) => `↪ hook ${r.blocked ? "failed" : "ok"}: ${r.output.split("\n")[0]}`).join("\n");
}
