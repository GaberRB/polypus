import type { ChatResponse, Message, ToolCall, ToolSpec } from "../providers/types.js";
import type { PromptContext } from "./system-prompt.js";

/**
 * A ProtocolDriver hides whether tool-calling is native (function API) or
 * emulated (XML in the prompt) from the agent loop. The loop only deals with
 * messages, tool calls, and tool results.
 */
export interface ProtocolDriver {
  readonly kind: "native" | "emulated";
  /** System prompt to seed the conversation. */
  systemPrompt(ctx: PromptContext): string;
  /** Tools to pass to the provider (undefined for emulated, which encodes them in the prompt). */
  providerTools(): ToolSpec[] | undefined;
  /** Extract tool calls and prose from a provider response. */
  parse(response: ChatResponse): { toolCalls: ToolCall[]; text: string };
  /** Build the assistant message to append to history for this turn. */
  assistantMessage(response: ChatResponse, toolCalls: ToolCall[]): Message;
  /** Build the message that feeds a tool's result back to the model. */
  toolResultMessage(call: ToolCall, resultText: string): Message;
  /** Message used to nudge the model when it produced no tool call. */
  repromptMessage(): Message;
}
