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

/** Anthropic's cache breakpoint marker. Everything up to a marked element is
 * cached as a reusable prefix (min 1024 tokens, or 2048 on Haiku; below that the
 * marker is silently ignored). Up to 4 markers per request. */
const EPHEMERAL = { type: "ephemeral" as const };
type CacheControl = typeof EPHEMERAL;

interface AnthropicBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: unknown;
  cache_control?: CacheControl;
}

interface AnthropicToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  cache_control?: CacheControl;
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

    // Prompt caching: mark stable prefixes so repeated loop iterations re-read
    // them at ~0.1x instead of reprocessing the whole prompt. Undefined = on.
    const cacheEnabled = req.params?.cache !== false;

    const tools: AnthropicToolDef[] | undefined = req.tools?.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));
    if (cacheEnabled && tools && tools.length > 0) {
      // Breakpoint after the last tool → caches the whole tool block.
      tools[tools.length - 1]!.cache_control = EPHEMERAL;
    }
    if (cacheEnabled) markLastBlock(messages); // advancing history breakpoint

    // System as a cacheable text block (array form) when caching is on.
    const systemField = system
      ? cacheEnabled
        ? [{ type: "text", text: system, cache_control: EPHEMERAL }]
        : system
      : undefined;

    const body = {
      model: this.model,
      max_tokens: req.params?.maxTokens ?? 8192,
      temperature: req.params?.temperature,
      ...(systemField ? { system: systemField } : {}),
      messages,
      ...(tools && tools.length > 0 ? { tools } : {}),
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    // Forward an external abort (e.g. user pressed ESC) to this request.
    if (req.signal) {
      if (req.signal.aborted) controller.abort();
      else req.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
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
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      };
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

    const u = data.usage;
    return {
      content: text,
      toolCalls,
      finishReason: data.stop_reason ?? "stop",
      usage: u
        ? {
            // Anthropic's input_tokens EXCLUDES cached tokens; add them back so
            // promptTokens reflects the true context size (cost applies the
            // cache discount separately in usage.ts).
            promptTokens:
              (u.input_tokens ?? 0) +
              (u.cache_read_input_tokens ?? 0) +
              (u.cache_creation_input_tokens ?? 0),
            completionTokens: u.output_tokens,
            cacheReadTokens: u.cache_read_input_tokens,
            cacheCreationTokens: u.cache_creation_input_tokens,
          }
        : undefined,
    };
  }
}

/** Attach a cache breakpoint to the final content block of the final message,
 * so the whole conversation so far becomes a cached prefix next iteration. */
function markLastBlock(
  messages: Array<{ role: "user" | "assistant"; content: AnthropicBlock[] }>,
): void {
  const lastMsg = messages[messages.length - 1];
  const lastBlock = lastMsg?.content[lastMsg.content.length - 1];
  if (lastBlock) lastBlock.cache_control = EPHEMERAL;
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
