import type { ToolSpec } from "../providers/types.js";
import type { PermissionMode } from "../config/schema.js";
import { getLocale, LOCALE_NAMES, t } from "../i18n/index.js";

export interface PromptContext {
  workspace: string;
  mode: PermissionMode;
  allow: string[];
  /** Extra agent-specific instructions (e.g. a subtask brief from the orchestrator). */
  briefing?: string;
  /** Project operating instructions loaded from `.poly/agents.md` (or `AGENTS.md`). */
  projectInstructions?: string;
}

/** Shared role/permission preamble used by both the native and emulated paths. */
function basePreamble(ctx: PromptContext): string {
  const modeLine =
    ctx.mode === "plan"
      ? "You are in PLAN mode: investigate and propose changes, but do NOT modify files or run commands. Describe the plan and call `finish`."
      : ctx.mode === "review"
        ? "You are in REVIEW mode: each file write and command will be shown to the user for approval before it runs."
        : "You are in BYPASS mode: actions are applied automatically.";

  return [
    "You are Polypus, an autonomous coding agent working inside a real project directory.",
    "",
    `Workspace (current working directory): ${ctx.workspace}`,
    `Editable paths (glob allow-list): ${ctx.allow.join(", ")}`,
    modeLine,
    "",
    "IMPORTANT — you have real permission to act:",
    "- YES, you ARE allowed to create, read, and modify files in this workspace.",
    "- YES, you ARE allowed to run shell commands (subject to the permission mode above).",
    "- Do not ask for permission and do not say you cannot edit files — you can. Just emit the tool calls.",
    "- Make the changes directly. When the task is fully done, call the `finish` tool with a short summary.",
    t("prompt.language", { language: LOCALE_NAMES[getLocale()] }),
    ctx.projectInstructions ? `\n${t("prompt.projectInstructions")}\n\n${ctx.projectInstructions}` : "",
    ctx.briefing ? `\nYour assigned task:\n${ctx.briefing}` : "",
  ].join("\n");
}

export function buildNativeSystemPrompt(ctx: PromptContext): string {
  return [
    basePreamble(ctx),
    "",
    "Use the provided tools/functions to read and edit files and run commands. Prefer small, targeted edits.",
  ].join("\n");
}

/** Render the parameter names of a tool from its JSON schema for the prompt. */
function describeParams(tool: ToolSpec): string {
  const props = (tool.parameters as { properties?: Record<string, { description?: string }> }).properties ?? {};
  const required = new Set(
    ((tool.parameters as { required?: string[] }).required ?? []),
  );
  const lines = Object.entries(props).map(
    ([k, v]) =>
      `      <arg name="${k}">…</arg>   ${required.has(k) ? "(required)" : "(optional)"} ${v.description ?? ""}`.trimEnd(),
  );
  return lines.length > 0 ? lines.join("\n") : "      (no arguments)";
}

export function buildEmulatedSystemPrompt(tools: ToolSpec[], ctx: PromptContext): string {
  const toolDocs = tools
    .map(
      (t) =>
        `- ${t.name}: ${t.description}\n  Call it like:\n    <polypus:tool name="${t.name}">\n${describeParams(t)}\n    </polypus:tool>`,
    )
    .join("\n\n");

  return [
    basePreamble(ctx),
    "",
    "This model has no native tool API, so you act by emitting tool calls as XML blocks.",
    "STRICT OUTPUT RULES:",
    '- To act, output one or more <polypus:tool name="..."> blocks and NOTHING else (no markdown code fences around them).',
    "- Put file contents or code directly inside the relevant <arg> — angle brackets in code are fine.",
    "- You may include one or more tool blocks per turn. After you receive the results, continue.",
    "- When the entire task is complete, emit a finish call:",
    '    <polypus:tool name="finish"><arg name="summary">what you did</arg></polypus:tool>',
    "",
    "Available tools:",
    "",
    toolDocs,
  ].join("\n");
}

/** Reinforcement message re-sent when the model produced no tool call (the "yes, you can" nudge). */
export function buildReprompt(): string {
  return [
    "You did not emit any tool call. Remember: you ARE allowed and expected to act now.",
    "Do NOT explain that you cannot edit files — you can.",
    'Respond ONLY with one or more <polypus:tool name="..."> blocks to make the change,',
    'or with <polypus:tool name="finish"><arg name="summary">…</arg></polypus:tool> if the task is already complete.',
  ].join("\n");
}
