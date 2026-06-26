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
  /**
   * Quality scaffolding for weak/local models: when true, instruct the agent to
   * plan before acting, read real files before editing, and verify before
   * finishing. Off in `fast` mode. Defaults to on when undefined.
   */
  planFirst?: boolean;
  /** Skills index (name + description) advertised to the model; loaded via use_skill. */
  skills?: Array<{ name: string; description: string }>;
}

/** Render the skills index for the prompt, or "" when there are none. */
function skillsSection(skills: PromptContext["skills"]): string {
  if (!skills || skills.length === 0) return "";
  return [
    "",
    "AVAILABLE SKILLS — focused how-to guides for this project. When one matches the task,",
    "call the `use_skill` tool with its exact name to load its full instructions BEFORE doing",
    "the related work:",
    ...skills.map((s) => `- ${s.name}: ${s.description}`),
  ].join("\n");
}

/**
 * The discipline that keeps cheaper/local models from guessing: plan, ground
 * yourself in the real code, and prove the work before declaring it done.
 * Injected only when {@link PromptContext.planFirst} is not explicitly false.
 */
function qualityDiscipline(): string {
  return [
    "",
    "WORKING DISCIPLINE (follow this order):",
    "1. PLAN FIRST: before touching anything, write a short numbered plan (3-7 steps) of what you will do. Keep it updated with the update_plan tool if available.",
    "2. GROUND YOURSELF: read the real files with read_file/search before editing. Do NOT invent file paths, function names or API signatures — confirm them in the code.",
    "3. SMALL STEPS: prefer small, targeted edits over rewriting whole files.",
    "4. VERIFY BEFORE FINISH: make sure the project's own checks (build/typecheck/test) would pass. Only then call finish with a concrete summary.",
  ].join("\n");
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
    "- Do NOT start long-running servers or watchers (e.g. `npm run dev`, `npm start`, `start /B node …`, `vite`): they never return, block the run and stall you. To verify, run one-shot checks like `npm run build`, `npm test` or `npm run typecheck`.",
    "- For the web: `web_search` finds pages, `web_fetch` reads one, `download` saves a file into the workspace. These are https-only and block private/internal hosts — don't try to reach localhost or intranet addresses.",
    "- Make the changes directly. When the task is fully done, call the `finish` tool with a short summary.",
    t("prompt.language", { language: LOCALE_NAMES[getLocale()] }),
    ctx.planFirst !== false ? qualityDiscipline() : "",
    skillsSection(ctx.skills),
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
