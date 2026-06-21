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
    const base = {
      model: this.model,
      messages,
      ...(tools && tools.length > 0 ? { tools } : {}),
      temperature: req.params?.temperature,
      // Generous default so large files aren't truncated mid tool-call.
      max_tokens: req.params?.maxTokens ?? 8192,
    };

    // Streaming path: emit text chunks live while aggregating the full response.
    if (req.onDelta) {
      const stream = await this.client.chat.completions.create(
        { ...base, stream: true, stream_options: { include_usage: true } },
        { signal: req.signal },
      );
      const agg = await aggregateStream(stream as AsyncIterable<StreamChunk>, req.onDelta);
      return {
        content: agg.content,
        toolCalls: agg.toolCalls.map((tc, i) => ({
          id: tc.id || `call_${i}`,
          name: tc.name,
          arguments: safeParseArgs(tc.arguments),
        })),
        finishReason: agg.finishReason || "stop",
        usage: agg.usage,
      };
    }

    const completion = await this.client.chat.completions.create(
      { ...base },
      { signal: req.signal },
    );

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

/** Minimal shape of an OpenAI streaming chunk (only the fields we read). */
export interface StreamChunk {
  choices?: Array<{
    delta?: {
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason?: string | null;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
}

export interface AggregatedStream {
  content: string;
  toolCalls: Array<{ id: string; name: string; arguments: string }>;
  finishReason: string;
  usage?: { promptTokens?: number; completionTokens?: number };
}

/**
 * Consume an OpenAI-style chat stream, calling `onDelta` for each text chunk and
 * aggregating content, tool-call deltas (by index), finish reason, and usage.
 * Pure (no SDK dependency) so it can be unit-tested with a mocked iterable.
 */
export async function aggregateStream(
  stream: AsyncIterable<StreamChunk>,
  onDelta?: (chunk: string) => void,
): Promise<AggregatedStream> {
  let content = "";
  let finishReason = "";
  let usage: AggregatedStream["usage"];
  const toolAcc: Array<{ id: string; name: string; arguments: string }> = [];

  for await (const chunk of stream) {
    const choice = chunk.choices?.[0];
    const delta = choice?.delta;
    if (delta?.content) {
      content += delta.content;
      onDelta?.(delta.content);
    }
    for (const tc of delta?.tool_calls ?? []) {
      const slot = (toolAcc[tc.index] ??= { id: "", name: "", arguments: "" });
      if (tc.id) slot.id = tc.id;
      if (tc.function?.name) slot.name = tc.function.name;
      if (tc.function?.arguments) slot.arguments += tc.function.arguments;
    }
    if (choice?.finish_reason) finishReason = choice.finish_reason;
    if (chunk.usage) {
      usage = {
        promptTokens: chunk.usage.prompt_tokens,
        completionTokens: chunk.usage.completion_tokens,
      };
    }
  }

  return { content, finishReason, usage, toolCalls: toolAcc.filter(Boolean) };
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
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) return parsed as Record<string, unknown>;
    return { value: parsed };
  } catch {
    // Models often emit invalid JSON for large code payloads (unescaped quotes/
    // newlines in 'content'). Recover the common string fields heuristically.
    return recoverArgs(raw);
  }
}

const SHORT_FIELDS = ["path", "command", "summary"] as const;
const LONG_FIELDS = ["content", "replace", "search"] as const;

/** Best-effort extraction of known tool arguments from malformed JSON. */
function recoverArgs(raw: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of SHORT_FIELDS) {
    const m = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(raw);
    if (m) out[key] = unescapeJsonString(m[1]!);
  }
  // Long fields may contain unescaped quotes/newlines: capture from the key up
  // to the last double-quote in the payload (the closing quote before `}`).
  for (const key of LONG_FIELDS) {
    const opener = new RegExp(`"${key}"\\s*:\\s*"`).exec(raw);
    if (!opener) continue;
    const from = opener.index + opener[0].length;
    const end = raw.lastIndexOf('"');
    if (end > from) out[key] = unescapeJsonString(raw.slice(from, end));
  }
  if (Object.keys(out).length === 0) out._raw = raw;
  return out;
}

/** Exposed for unit tests. */
export const __test_safeParseArgs = safeParseArgs;

function unescapeJsonString(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\//g, "/")
    .replace(/\\\\/g, "\\");
}
