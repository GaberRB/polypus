import type {
  ChatRequest,
  ChatResponse,
  Message,
  Provider,
  ToolCall,
} from "./types.js";

export interface AnthropicOptions {
  name: string;
  model: string;
  baseURL: string;
  apiKey: string;
  timeoutMs?: number;
}

interface AnthropicBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: unknown;
}

/** Minimal native provider for the Anthropic Messages API (no SDK dependency). */
export class AnthropicProvider implements Provider {
  readonly name: string;
  readonly model: string;
  private readonly baseURL: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(opts: AnthropicOptions) {
    this.name = opts.name;
    this.model = opts.model;
    this.baseURL = opts.baseURL.replace(/\/$/, "");
    this.apiKey = opts.apiKey;
    this.timeoutMs = opts.timeoutMs ?? 120_000;
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const system = req.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");

    const messages = groupMessages(req.messages.filter((m) => m.role !== "system"));

    const body = {
      model: this.model,
      max_tokens: req.params?.maxTokens ?? 4096,
      temperature: req.params?.temperature,
      ...(system ? { system } : {}),
      messages,
      ...(req.tools && req.tools.length > 0
        ? {
            tools: req.tools.map((t) => ({
              name: t.name,
              description: t.description,
              input_schema: t.parameters,
            })),
          }
        : {}),
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await fetch(`${this.baseURL}/v1/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 500)}`);
    }

    const data = (await res.json()) as {
      content: AnthropicBlock[];
      stop_reason?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const text = data.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
    const toolCalls: ToolCall[] = data.content
      .filter((b) => b.type === "tool_use")
      .map((b) => ({
        id: b.id ?? "",
        name: b.name ?? "",
        arguments: b.input ?? {},
      }));

    return {
      content: text,
      toolCalls,
      finishReason: data.stop_reason ?? "stop",
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
          }
        : undefined,
    };
  }
}

/**
 * Convert our flat message list into Anthropic's block format, grouping
 * consecutive tool results into one user turn so roles alternate correctly.
 */
function groupMessages(
  messages: Message[],
): Array<{ role: "user" | "assistant"; content: AnthropicBlock[] }> {
  const out: Array<{ role: "user" | "assistant"; content: AnthropicBlock[] }> = [];

  for (const m of messages) {
    if (m.role === "tool") {
      const block: AnthropicBlock = {
        type: "tool_result",
        tool_use_id: m.toolCallId ?? "",
        content: m.content,
      };
      const last = out[out.length - 1];
      if (last && last.role === "user") last.content.push(block);
      else out.push({ role: "user", content: [block] });
      continue;
    }

    if (m.role === "assistant") {
      const blocks: AnthropicBlock[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const tc of m.toolCalls ?? []) {
        blocks.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.arguments });
      }
      out.push({ role: "assistant", content: blocks });
      continue;
    }

    // user
    out.push({ role: "user", content: [{ type: "text", text: m.content }] });
  }

  return out;
}
