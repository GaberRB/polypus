import type { ResolvedAgent } from "../providers/registry.js";
import type { Message } from "../providers/types.js";

/** Rough token estimate when the provider does not report usage (~4 chars/token). */
export function estimateTokens(messages: Message[]): number {
  let chars = 0;
  for (const m of messages) chars += m.content.length;
  return Math.ceil(chars / 4);
}

/** How many of the most recent messages to keep verbatim after compaction. */
const RECENT_KEEP = 8;
/** Minimum number of old messages worth summarizing (below this, skip). */
const MIN_TO_COMPACT = 4;
/** Cap the text handed to the summarizer so the summary call itself stays small. */
const MAX_SUMMARY_INPUT = 40_000;

/**
 * Pick a cut index so the kept tail never starts mid tool-round: not on a tool
 * result, and not right after an assistant message that still has pending tool
 * calls (which would orphan those results for native providers).
 */
export function findSafeCut(messages: Message[], desiredKeep = RECENT_KEEP): number {
  let cut = Math.max(1, messages.length - desiredKeep);
  while (
    cut < messages.length &&
    (messages[cut]!.role === "tool" ||
      (messages[cut - 1]?.role === "assistant" && (messages[cut - 1]!.toolCalls?.length ?? 0) > 0))
  ) {
    cut++;
  }
  return cut;
}

function serialize(messages: Message[]): string {
  const text = messages
    .map((m) => {
      const tools = m.toolCalls?.length ? ` [called: ${m.toolCalls.map((c) => c.name).join(", ")}]` : "";
      return `${m.role}${tools}: ${m.content}`;
    })
    .join("\n\n");
  return text.length > MAX_SUMMARY_INPUT ? text.slice(-MAX_SUMMARY_INPUT) : text;
}

/**
 * Summarize the older middle of a conversation into a single message, preserving
 * the system prompt and the most recent messages. Returns the original array
 * (unchanged) when there is too little to compact or the cut is unsafe.
 */
export async function compactHistory(
  messages: Message[],
  agent: ResolvedAgent,
  signal?: AbortSignal,
): Promise<Message[]> {
  if (messages.length === 0) return messages;
  const system = messages[0]!.role === "system" ? messages[0]! : undefined;
  const startIdx = system ? 1 : 0;

  const cut = findSafeCut(messages);
  if (cut >= messages.length) return messages; // no safe tail to keep
  const middle = messages.slice(startIdx, cut);
  if (middle.length < MIN_TO_COMPACT) return messages;
  const tail = messages.slice(cut);

  const summary = await agent.provider.chat({
    messages: [
      {
        role: "system",
        content:
          "You compress a coding agent's conversation so it can continue with less context. " +
          "Summarize the messages below into a concise but information-dense brief that preserves: " +
          "the original task and goal, key decisions, files created/edited and why, important command/test " +
          "outputs, and any remaining TODOs or open problems. Use terse bullet points. Do not invent details.",
      },
      { role: "user", content: serialize(middle) },
    ],
    signal,
  });

  const summaryMessage: Message = {
    role: "user",
    content: `[Summary of earlier conversation, compacted to save context]\n${summary.content.trim()}`,
  };

  return system ? [system, summaryMessage, ...tail] : [summaryMessage, ...tail];
}
