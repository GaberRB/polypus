import type { ChatResponse, Message, ToolCall, ToolSpec } from "../providers/types.js";
import type { ProtocolDriver } from "./driver.js";
import { buildNativeSystemPrompt, type PromptContext } from "./system-prompt.js";

/** Driver for providers with native function-calling. */
export class NativeDriver implements ProtocolDriver {
  readonly kind = "native" as const;

  constructor(private readonly tools: ToolSpec[]) {}

  systemPrompt(ctx: PromptContext): string {
    return buildNativeSystemPrompt(ctx);
  }

  providerTools(): ToolSpec[] | undefined {
    return this.tools;
  }

  parse(response: ChatResponse): { toolCalls: ToolCall[]; text: string } {
    return { toolCalls: response.toolCalls, text: response.content };
  }

  assistantMessage(response: ChatResponse, toolCalls: ToolCall[]): Message {
    return { role: "assistant", content: response.content, toolCalls };
  }

  toolResultMessage(call: ToolCall, resultText: string): Message {
    return { role: "tool", toolCallId: call.id, name: call.name, content: resultText };
  }

  repromptMessage(): Message {
    return {
      role: "user",
      content:
        "You did not call any tool. Use the available tools to act now, or call `finish` if the task is complete.",
    };
  }
}
