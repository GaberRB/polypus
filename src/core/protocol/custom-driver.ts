/**
 * CustomDriver — protocol driver exclusively for user-defined custom providers.
 *
 * Custom providers are generic chat LLMs (e.g. external AI APIs, internal APIs) that
 * have no native tool API and do NOT produce <polypus:tool> XML.  Instead they
 * naturally output markdown code blocks.  This driver:
 *
 *   • All file/command operations use ```bash blocks (including heredoc for writes).
 *   • Only finish/read_file/ask_user/list_dir use ```json { "tool": "..." } blocks.
 *   • write_file is intentionally hidden — models express it naturally via bash.
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

// Tools hidden from custom providers — handled via bash instead.
const BASH_ONLY_TOOLS = new Set(["write_file", "run_command", "run_python_script"]);

function buildToolDocs(tools: ToolSpec[]): string {
  return tools
    .filter((tl) => !BASH_ONLY_TOOLS.has(tl.name))
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
    "## OUTPUT FORMATS",
    "",
    "You have exactly two formats. Use ONE per response, then wait for the result.",
    "",
    "### Format 1 — bash (for ALL shell commands AND file creation/editing)",
    "Wrap the command in a bash block:",
    "```bash",
    "python hello.py",
    "```",
    "",
    "### Format 2 — JSON (ONLY for finish, read_file, list_dir, ask_user)",
    "Wrap a JSON object in a json block:",
    "```json",
    '{ "tool": "finish", "summary": "what you did" }',
    "```",
    "",
    "## CREATING AND EDITING FILES — always use bash heredoc",
    "",
    "NEVER use any function call or special syntax to write files.",
    "ALWAYS use a bash heredoc. Examples:",
    "",
    "Create a Python file:",
    "```bash",
    "cat > hello.py << 'PYEOF'",
    'print("Hello World")',
    "PYEOF",
    "```",
    "",
    "Create a file with multiple lines:",
    "```bash",
    "cat > app.js << 'JSEOF'",
    "const x = 1;",
    "console.log(x);",
    "JSEOF",
    "```",
    "",
    "Append to an existing file:",
    "```bash",
    "cat >> existing.txt << 'EOF'",
    "new line here",
    "EOF",
    "```",
    "",
    "## STEP ORDER — mandatory sequence",
    "",
    "Example — task: 'create hello.py and run it':",
    "",
    "Step 1 — create the file with heredoc:",
    "```bash",
    "cat > hello.py << 'PYEOF'",
    'print("Hello World")',
    "PYEOF",
    "```",
    "→ wait for result, then:",
    "",
    "Step 2 — run it:",
    "```bash",
    "python hello.py",
    "```",
    "→ wait for result, then:",
    "",
    "Step 3 — finish:",
    "```json",
    '{ "tool": "finish", "summary": "Created hello.py and ran it successfully." }',
    "```",
    "",
    "## SELF-RECOVERY RULES",
    "",
    "- File does not exist → create it with cat heredoc BEFORE running.",
    "- Dependency missing → install it first (pip install / npm install).",
    "- Syntax error in a file → use read_file to inspect, then overwrite with heredoc.",
    "- On ANY error → fix the root cause, do NOT retry the exact same command.",
    "- NEVER respond with plain prose. ALWAYS emit a bash or json block.",
    "- NEVER end a turn without a tool call.",
    t("prompt.language", { language: LOCALE_NAMES[getLocale()] }),
    "",
    "## AVAILABLE JSON TOOLS (finish, read, list, ask)",
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
      return (
        "⚠ RECOVERY: The file does not exist yet. Create it first using a bash heredoc:\n" +
        "```bash\ncat > <filename> << 'EOF'\n<content>\nEOF\n```"
      );
    }
    if (/modulenotfounderror|module not found|cannot find module/i.test(lower)) {
      return "⚠ RECOVERY: A dependency is missing. Run the install command (e.g. pip install <pkg> or npm install) before retrying.";
    }
    if (/permission denied/i.test(lower)) {
      return "⚠ RECOVERY: Permission denied. Check the file path or create parent directories with: ```bash\nmkdir -p <dir>\n```";
    }
    if (/syntaxerror|syntax error/i.test(lower)) {
      return "⚠ RECOVERY: Syntax error in the file. Read it with read_file, then overwrite it using a bash heredoc to fix the issue.";
    }
  }

  return "⚠ RECOVERY: The last action failed. Fix the root cause using a bash command or a JSON tool call before continuing.";
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
        "You did not emit a tool call. Respond ONLY with one of these two formats:",
        "• Bash (commands AND file creation): ```bash\\n<command or heredoc>\\n```",
        '• JSON (finish/read_file/list_dir/ask_user only): ```json\\n{ "tool": "<name>", ... }\\n```',
        "To create a file use: ```bash\\ncat > file.py << 'EOF'\\n<content>\\nEOF\\n```",
        "Never respond with plain text or function calls. Continue the original task above.",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }
}
