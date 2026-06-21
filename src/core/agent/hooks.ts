import { exec } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import type { ToolCall } from "../providers/types.js";

const execAsync = promisify(exec);
const HOOK_TIMEOUT = 120_000;

const HooksSchema = z.object({
  /** Shell command run after a successful write_file. `{path}` is substituted. */
  afterWrite: z.string().optional(),
  /** Shell command run after a successful edit_file. `{path}` is substituted. */
  afterEdit: z.string().optional(),
  /** Shell command run after any successful mutating tool. `{tool}`/`{path}` substituted. */
  afterTool: z.string().optional(),
  /** Block run_command when the command contains any of these substrings. */
  beforeCommand: z.object({ deny: z.array(z.string()).default([]) }).optional(),
});

export type HooksConfig = z.infer<typeof HooksSchema>;

/** Load `.poly/hooks.json` for a workspace, or undefined if absent/invalid. */
export async function loadHooks(workspace: string): Promise<HooksConfig | undefined> {
  try {
    const raw = await readFile(join(workspace, ".poly", "hooks.json"), "utf8");
    const parsed = HooksSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/** Decide whether a command is blocked by the user's beforeCommand deny-list. */
export function screenCommandHook(hooks: HooksConfig | undefined, command: string): { blocked: boolean; reason?: string } {
  const deny = hooks?.beforeCommand?.deny ?? [];
  for (const needle of deny) {
    if (needle && command.includes(needle)) {
      return { blocked: true, reason: `matches deny rule "${needle}"` };
    }
  }
  return { blocked: false };
}

function substitute(template: string, call: ToolCall): string {
  const path = typeof call.arguments.path === "string" ? call.arguments.path : "";
  return template.replace(/\{path\}/g, path).replace(/\{tool\}/g, call.name);
}

/**
 * Run post-tool hooks for a successful mutating tool call. Returns a short note
 * to append to the tool result (e.g. "↪ hook afterWrite ok"), or undefined.
 */
export async function runAfterHook(
  hooks: HooksConfig | undefined,
  call: ToolCall,
  workspace: string,
): Promise<string | undefined> {
  if (!hooks) return undefined;
  const commands: { label: string; cmd: string }[] = [];
  if (call.name === "write_file" && hooks.afterWrite) commands.push({ label: "afterWrite", cmd: hooks.afterWrite });
  if (call.name === "edit_file" && hooks.afterEdit) commands.push({ label: "afterEdit", cmd: hooks.afterEdit });
  if (hooks.afterTool) commands.push({ label: "afterTool", cmd: hooks.afterTool });
  if (commands.length === 0) return undefined;

  const notes: string[] = [];
  for (const { label, cmd } of commands) {
    const resolved = substitute(cmd, call);
    try {
      await execAsync(resolved, { cwd: workspace, timeout: HOOK_TIMEOUT, windowsHide: true });
      notes.push(`↪ hook ${label} ok`);
    } catch (err) {
      notes.push(`↪ hook ${label} failed: ${(err as Error).message.split("\n")[0]}`);
    }
  }
  return notes.join("\n");
}
