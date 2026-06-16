import OpenAI from "openai";
import type {
  ChatRequest,
  ChatResponse,
  Message,
  Provider,
  ToolCall,
} from "./types.js";

export interface OpenAICompatibleOptions {
  name: string;
  model: string;
  baseURL: string;
  apiKey?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

/**
 * Provider for any OpenAI-compatible Chat Completions endpoint.
 * Covers OpenRouter, Ollama (`/v1`), and generic gateways. Native tool-calling
 * is used when `tools` are supplied; the emulated path simply omits them.
 */
export class OpenAICompatibleProvider implements Provider {
  readonly name: string;
  readonly model: string;
  private readonly client: OpenAI;

  constructor(opts: OpenAICompatibleOptions) {
    this.name = opts.name;
    this.model = opts.model;
    this.client = new OpenAI({
      baseURL: opts.baseURL,
      // Ollama accepts any non-empty key; OpenRouter requires a real one.
      apiKey: opts.apiKey ?? "polypus-no-key",
      timeout: opts.timeoutMs ?? 120_000,
      maxRetries: opts.maxRetries ?? 2,
    });
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const messages = req.messages.map(toOpenAIMessage);
    const tools = req.tools?.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages,
      ...(tools && tools.length > 0 ? { tools } : {}),
      temperature: req.params?.temperature,
      max_tokens: req.params?.maxTokens,
    });

    const choice = completion.choices[0];
    const msg = choice?.message;
    const toolCalls: ToolCall[] = (msg?.tool_calls ?? []).map((tc, i) => ({
      id: tc.id || `call_${i}`,
      name: tc.function.name,
      arguments: safeParseArgs(tc.function.arguments),
    }));

    return {
      content: msg?.content ?? "",
      toolCalls,
      finishReason: choice?.finish_reason ?? "stop",
      usage: completion.usage
        ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
          }
        : undefined,
    };
  }
}

function toOpenAIMessage(m: Message): OpenAI.Chat.ChatCompletionMessageParam {
  switch (m.role) {
    case "tool":
      return {
        role: "tool",
        content: m.content,
        tool_call_id: m.toolCallId ?? "",
      };
    case "assistant":
      return {
        role: "assistant",
        content: m.content || null,
        ...(m.toolCalls && m.toolCalls.length > 0
          ? {
              tool_calls: m.toolCalls.map((tc) => ({
                id: tc.id,
                type: "function" as const,
                function: {
                  name: tc.name,
                  arguments: JSON.stringify(tc.arguments),
                },
              })),
            }
          : {}),
      };
    case "system":
      return { role: "system", content: m.content };
    default:
      return { role: "user", content: m.content };
  }
}

function safeParseArgs(raw: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : { value: parsed };
  } catch {
    return { _raw: raw };
  }
}
