import type { ToolCall } from "../providers/types.js";

/**
 * Tolerant parser for the emulated XML tool protocol. Extracts blocks of the form:
 *
 *   <polypus:tool name="write_file">
 *     <arg name="path">src/index.ts</arg>
 *     <arg name="content">...code...</arg>
 *   </polypus:tool>
 *
 * Arg values may contain `<` and `>` (code). Values are read up to the last
 * </arg> before the next sibling <arg ...> (or the end of the tool block), which
 * tolerates angle brackets inside code without a strict XML parser.
 */
const TOOL_OPEN = /<polypus:tool\s+name="([^"]+)"\s*>/g;
const TOOL_CLOSE = "</polypus:tool>";
const ARG_OPEN = /<arg\s+name="([^"]+)"\s*>/g;

export interface ParseResult {
  toolCalls: ToolCall[];
  /** Text outside of any tool block (model reasoning / prose). */
  text: string;
}

/**
 * Parse emulated tool calls. `knownToolNames` enables a tolerant fallback for
 * the shorthand form some models drift to (e.g. `<finish>...</finish>` instead
 * of `<polypus:tool name="finish">`).
 */
export function parseEmulatedToolCalls(
  output: string,
  knownToolNames: string[] = [],
): ParseResult {
  const toolCalls: ToolCall[] = [];
  const proseParts: string[] = [];
  let cursor = 0;
  let callIndex = 0;

  TOOL_OPEN.lastIndex = 0;
  let open: RegExpExecArray | null;
  while ((open = TOOL_OPEN.exec(output))) {
    const name = open[1]!;
    const blockStart = open.index + open[0].length;
    const closeIdx = output.indexOf(TOOL_CLOSE, blockStart);
    if (closeIdx === -1) break; // unterminated block; bail out tolerantly

    proseParts.push(output.slice(cursor, open.index));
    const block = output.slice(blockStart, closeIdx);
    toolCalls.push({
      id: `emu_${callIndex++}`,
      name: name.trim(),
      arguments: parseArgs(block),
    });

    cursor = closeIdx + TOOL_CLOSE.length;
    TOOL_OPEN.lastIndex = cursor;
  }
  proseParts.push(output.slice(cursor));

  let text = proseParts.join("").trim();

  // Strip orphan open/close tags that weak models sometimes leave dangling.
  text = text.replace(/<\/?polypus:tool[^>]*>/g, "").trim();

  // Tolerant fallbacks for known tool names that weak models drift toward.
  if (knownToolNames.length > 0) {
    for (const name of knownToolNames) {
      const n = escapeName(name);

      // (a) Tag shorthand: <finish>...</finish>
      const tagRe = new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, "g");
      let m: RegExpExecArray | null;
      while ((m = tagRe.exec(text))) {
        toolCalls.push({ id: `emu_${callIndex++}`, name, arguments: parseArgs(m[1]!) });
      }
      text = text.replace(tagRe, "").trim();

      // (b) Label form: `finish:` followed by one or more <arg> blocks.
      const labelRe = new RegExp(
        `(?:^|\\n)[ \\t]*${n}[ \\t]*:?[ \\t]*\\n?((?:[ \\t]*<arg\\b[\\s\\S]*?</arg>[ \\t]*\\n?)+)`,
        "g",
      );
      while ((m = labelRe.exec(text))) {
        toolCalls.push({ id: `emu_${callIndex++}`, name, arguments: parseArgs(m[1]!) });
      }
      text = text.replace(labelRe, "").trim();
    }
  }

  return { toolCalls, text };
}

function escapeName(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseArgs(block: string): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  ARG_OPEN.lastIndex = 0;

  const matches: Array<{ name: string; valueStart: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = ARG_OPEN.exec(block))) {
    matches.push({ name: m[1]!, valueStart: m.index + m[0].length });
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i]!;
    const next = matches[i + 1];
    const region = block.slice(current.valueStart, next ? next.valueStart : block.length);
    args[current.name.trim()] = trimArgValue(stripLastCloseTag(region));
  }
  return args;
}

/**
 * Keep only what precedes this arg's closing </arg>. For a non-final arg the
 * region also contains the next <arg ...> opener after the close tag; using the
 * last </arg> before that opener correctly isolates the current value.
 */
function stripLastCloseTag(region: string): string {
  const idx = region.lastIndexOf("</arg>");
  return idx === -1 ? region : region.slice(0, idx);
}

/** Trim a single leading/trailing newline that models tend to add around block values. */
function trimArgValue(value: string): string {
  return value.replace(/^\r?\n/, "").replace(/\r?\n[ \t]*$/, "");
}
