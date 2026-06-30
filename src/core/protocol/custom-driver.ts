/**
 * CustomDriver — protocol driver exclusively for user-defined custom providers.
 *
 * Custom providers are generic chat LLMs (e.g. external AI APIs, internal APIs) that
 * have no native tool API and do NOT produce <polypus:tool> XML.  Instead they
 * naturally output markdown code blocks.  This driver:
 *
 *   • Teaches the model a two-format convention in the system prompt:
 *       - ```bash / ```sh  →  run_command
 *       - ```json { "tool": "...", ... }  →  any other tool (write_file, finish, …)
 *
 *   • Parses both formats out of the model response.
 *
 * Zero overlap with EmulatedDriver or NativeDriver — those files are untouched.
 */

import type { ChatResponse, Message, ToolCall, ToolSpec } from "../providers/types.js";
import type { ProtocolDriver } from "./driver.js";
import type { PromptContext } from "./system-prompt.js";
import { getLocale, LOCALE_NAMES, t } from "../i18n/index.js";

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

function buildToolDocs(tools: ToolSpec[]): string {
  return tools
    .map((tl) => {
      const props =
        (tl.parameters as { properties?: Record<string, { description?: string }> }).properties ?? {};
      const required = new Set(
        ((tl.parameters as { required?: string[] }).required ?? []),
      );
      const args = Object.entries(props)
        .map(([k, v]) => `    "${k}": "…"  // ${required.has(k) ? "required" : "optional"} — ${v.description ?? ""}`)
        .join("\n");
      return `- **${tl.name}**: ${tl.description}\n  JSON format:\n  \`\`\`json\n  { "tool": "${tl.name}"${args ? `,\n${args}` : ""} }\n  \`\`\``;
    })
    .join("\n\n");
}

export function buildCustomProviderSystemPrompt(tools: ToolSpec[], ctx: PromptContext): string {
  const modeLine =
    ctx.mode === "plan"
      ? "You are in PLAN mode: investigate and propose, do NOT modify files or run commands."
      : ctx.mode === "review"
        ? "You are in REVIEW mode: each write and command will be shown to the user for approval."
        : "You are in BYPASS mode: actions are applied automatically.";

  const toolDocs = buildToolDocs(tools);

  return [
    "You are Polypus, an autonomous coding agent working inside a real project directory.",
    "",
    `Workspace: ${ctx.workspace}`,
    `Editable paths: ${ctx.allow.join(", ")}`,
    modeLine,
    "",
    "## HOW TO USE TOOLS",
    "",
    "You have two output formats. Use exactly one per response, then wait for the result.",
    "",
    "### Format 1 — shell command (run_command)",
    "```bash",
    "npm run build",
    "```",
    "",
    "### Format 2 — any other tool (write_file, read_file, finish, …)",
    "```json",
    '{ "tool": "write_file", "path": "hello.py", "content": "print(\\"Hello World\\")\\n" }',
    "```",
    "",
    "## MANDATORY STEP ORDER",
    "",
    "Before running any file, you MUST create it first with write_file.",
    "Example — task: 'create hello.py and run it':",
    "",
    "Step 1 — create the file:",
    "```json",
    '{ "tool": "write_file", "path": "hello.py", "content": "print(\\"Hello World\\")\\n" }',
    "```",
    "→ wait for result, then step 2:",
    "",
    "Step 2 — run it:",
    "```bash",
    "python hello.py",
    "```",
    "→ wait for result, then step 3:",
    "",
    "Step 3 — done:",
    "```json",
    '{ "tool": "finish", "summary": "Created hello.py and ran it successfully." }',
    "```",
    "",
    "## SELF-RECOVERY RULES",
    "",
    "- If a command fails because a file does not exist → use write_file to create it first.",
    "- If a command fails because a dependency is missing → run the install command first.",
    "- If a tool result shows an error → fix the root cause with the appropriate tool, do NOT retry the same failing call.",
    "- NEVER give up and explain why something failed — fix it and continue.",
    "- NEVER respond with plain prose. ALWAYS emit a tool call.",
    "- When the task is fully done, emit finish. NEVER end a turn without a tool call.",
    t("prompt.language", { language: LOCALE_NAMES[getLocale()] }),
    "",
    "## AVAILABLE TOOLS",
    "",
    toolDocs,
    ctx.projectInstructions ? `\n## PROJECT INSTRUCTIONS\n\n${ctx.projectInstructions}` : "",
    ctx.briefing ? `\n## YOUR TASK\n\n${ctx.briefing}` : "",
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Extract the first fenced code block matching one of the given languages.
 * Returns { lang, content } or null.
 */
function extractCodeBlock(
  text: string,
  langs: string[],
): { lang: string; content: string } | null {
  const pattern = new RegExp(
    "```(" + langs.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")\\s*\\n([\\s\\S]*?)```",
    "i",
  );
  const m = pattern.exec(text);
  if (!m) return null;
  return { lang: m[1]!, content: m[2]!.trim() };
}

/**
 * Parse the model's markdown response into tool calls.
 *
 * Priority:
 *   1. ```json { "tool": "..." }  →  any named tool
 *   2. ```bash / ```sh            →  run_command
 *
 * Everything else is treated as plain text (no tool call).
 */
export function parseCustomToolCalls(
  text: string,
  _availableTools: string[],
): { toolCalls: ToolCall[]; text: string } {
  // 1. Try JSON tool block first.
  const jsonBlock = extractCodeBlock(text, ["json"]);
  if (jsonBlock) {
    try {
      const obj = JSON.parse(jsonBlock.content) as Record<string, unknown>;
      const toolName = typeof obj.tool === "string" ? obj.tool : null;
      if (toolName) {
        const args: Record<string, unknown> = { ...obj };
        delete args.tool;
        return {
          toolCalls: [{ id: `ctool_${Date.now()}`, name: toolName, arguments: args }],
          text: "",
        };
      }
    } catch {
      // Malformed JSON — fall through.
    }
  }

  // 2. Try bash/shell block → run_command.
  const bashBlock = extractCodeBlock(text, ["bash", "sh", "shell"]);
  if (bashBlock) {
    return {
      toolCalls: [
        {
          id: `ctool_${Date.now()}`,
          name: "run_command",
          arguments: { command: bashBlock.content },
        },
      ],
      text: "",
    };
  }

  // 3. No tool call detected — return plain text.
  return { toolCalls: [], text };
}

// ---------------------------------------------------------------------------
// Recovery hints — injected into tool result messages on failure
// ---------------------------------------------------------------------------

function recoveryHint(toolName: string, errorText: string): string {
  const lower = errorText.toLowerCase();

  if (toolName === "run_command") {
    if (/no such file|not found|cannot find/i.test(lower)) {
      return "⚠ RECOVERY: The file does not exist yet. Use write_file to create it before running.";
    }
    if (/modulenotfounderror|module not found|cannot find module/i.test(lower)) {
      return "⚠ RECOVERY: A dependency is missing. Run the install command (e.g. pip install <pkg> or npm install) before retrying.";
    }
    if (/permission denied/i.test(lower)) {
      return "⚠ RECOVERY: Permission denied. Try prefixing the command with the appropriate privilege escalation or check the file path.";
    }
    if (/syntaxerror|syntax error/i.test(lower)) {
      return "⚠ RECOVERY: There is a syntax error in the file. Use read_file to inspect it, then write_file to fix it.";
    }
  }

  if (toolName === "write_file") {
    return "⚠ RECOVERY: Failed to write the file. Check that the directory path exists; create parent directories with run_command (mkdir -p) if needed.";
  }

  return "⚠ RECOVERY: The last action failed. Analyse the error above and use the appropriate tool to fix the root cause before continuing.";
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

export class CustomDriver implements ProtocolDriver {
  readonly kind = "emulated" as const; // loop treats it like emulated (no provider-side tools)

  /**
   * The original user task (first user message). Injected into every
   * toolResultMessage so the model never loses sight of its goal — critical
   * for stateless external APIs that only see one message per call.
   */
  private readonly originalTask: string;

  constructor(
    private readonly tools: ToolSpec[],
    originalTask = "",
  ) {
    this.originalTask = originalTask;
  }

  systemPrompt(ctx: PromptContext): string {
    return buildCustomProviderSystemPrompt(this.tools, ctx);
  }

  providerTools(): ToolSpec[] | undefined {
    return undefined; // encoded in the system prompt
  }

  parse(response: ChatResponse): { toolCalls: ToolCall[]; text: string } {
    return parseCustomToolCalls(response.content, this.tools.map((t) => t.name));
  }

  assistantMessage(response: ChatResponse): Message {
    return { role: "assistant", content: response.content };
  }

  toolResultMessage(call: ToolCall, resultText: string): Message {
    const isError =
      /error|not found|no such file|command not found|failed|cannot|permission denied/i.test(
        resultText,
      );

    const hint = isError ? recoveryHint(call.name, resultText) : "";

    return {
      role: "user",
      content: [
        // Always remind the model of the original goal. External APIs that only
        // see the last user message would otherwise lose all context after turn 1.
        this.originalTask ? `[ORIGINAL TASK]: ${this.originalTask}` : "",
        `[TOOL RESULT] ${call.name}:`,
        resultText,
        hint,
        "→ Emit your next tool call now to continue the original task. Do NOT explain — just act.",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  repromptMessage(): Message {
    return {
      role: "user",
      content: [
        this.originalTask ? `[ORIGINAL TASK]: ${this.originalTask}` : "",
        "You did not emit a tool call. Remember: respond ONLY with a code block.",
        "For shell commands: ```bash\\n<command>\\n```",
        'For other tools: ```json\\n{ "tool": "<name>", ... }\\n```',
        "Never respond with plain text. Continue the original task above.",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }
}
