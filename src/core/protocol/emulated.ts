import type { ChatResponse, Message, ToolCall, ToolSpec } from "../providers/types.js";
import type { ProtocolDriver } from "./driver.js";
import { NativeDriver } from "./native.js";
import { parseEmulatedToolCalls } from "./parser.js";
import {
  buildEmulatedSystemPrompt,
  buildReprompt,
  type PromptContext,
} from "./system-prompt.js";

/** Driver for models without native tool-calling: tools are encoded as XML in the prompt. */
export class EmulatedDriver implements ProtocolDriver {
  readonly kind = "emulated" as const;

  constructor(private readonly tools: ToolSpec[]) {}

  systemPrompt(ctx: PromptContext): string {
    return buildEmulatedSystemPrompt(this.tools, ctx);
  }

  providerTools(): ToolSpec[] | undefined {
    return undefined; // encoded in the system prompt instead
  }

  parse(response: ChatResponse): { toolCalls: ToolCall[]; text: string } {
    return parseEmulatedToolCalls(
      response.content,
      this.tools.map((t) => t.name),
    );
  }

  assistantMessage(response: ChatResponse): Message {
    // Keep the raw output (including the XML) so the model sees its own actions.
    return { role: "assistant", content: response.content };
  }

  toolResultMessage(call: ToolCall, resultText: string): Message {
    // Emulated models don't understand the `tool` role; feed results back as user text.
    return {
      role: "user",
      content: `<polypus:tool_result name="${call.name}">\n${resultText}\n</polypus:tool_result>`,
    };
  }

  repromptMessage(): Message {
    return { role: "user", content: buildReprompt() };
  }
}

export function makeDriver(
  kind: "native" | "emulated",
  tools: ToolSpec[],
): ProtocolDriver {
  return kind === "native" ? new NativeDriver(tools) : new EmulatedDriver(tools);
}
