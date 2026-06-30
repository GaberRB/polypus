/**
 * CustomDriver — protocol driver exclusively for user-defined custom providers.
 *
 * Custom providers are generic chat LLMs (e.g. StackSpot, internal APIs) that
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
    "You have two output formats. Use exactly one of them per response.",
    "",
    "### 1. Shell command (run_command)",
    "Wrap the command in a bash/sh code block:",
    "```bash",
    "npm run build",
    "```",
    "",
    "### 2. Any other tool (write_file, read_file, finish, ask_user, …)",
    "Wrap a JSON object in a json code block:",
    "```json",
    '{ "tool": "write_file", "path": "hello.py", "content": "print(\\"Hello World\\")\\n" }',
    "```",
    "",
    "## RULES — READ CAREFULLY",
    "",
    "- ALWAYS respond with a tool call. NEVER respond with plain prose or explanations.",
    "- Do NOT explain what you are going to do — just do it with a tool call.",
    "- You may emit ONE tool block per response. Wait for the result before the next step.",
    "- When the task is fully done, call finish:",
    '  ```json',
    '  { "tool": "finish", "summary": "what you did" }',
    '  ```',
    "- NEVER end a turn without a tool call.",
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
// Driver
// ---------------------------------------------------------------------------

export class CustomDriver implements ProtocolDriver {
  readonly kind = "emulated" as const; // loop treats it like emulated (no provider-side tools)

  constructor(private readonly tools: ToolSpec[]) {}

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
    return {
      role: "user",
      content: `Tool result for ${call.name}:\n${resultText}`,
    };
  }

  repromptMessage(): Message {
    return {
      role: "user",
      content: [
        "You did not emit a tool call. Remember: respond ONLY with a code block.",
        "For shell commands: ```bash\\n<command>\\n```",
        'For other tools: ```json\\n{ "tool": "<name>", ... }\\n```',
        "Never respond with plain text.",
      ].join("\n"),
    };
  }
}
