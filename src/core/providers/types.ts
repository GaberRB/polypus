/** Unified chat/tool abstraction shared by every provider and both tool paths. */

export type Role = "system" | "user" | "assistant" | "tool";

/** A tool the model may call. `parameters` is a JSON Schema object. */
export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** A single tool invocation requested by the model. */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface Message {
  role: Role;
  content: string;
  /** Present on assistant messages that requested tools. */
  toolCalls?: ToolCall[];
  /** Present on `tool` messages: which call this result answers. */
  toolCallId?: string;
  /** Tool name, for `tool` messages. */
  name?: string;
}

export interface ChatParams {
  temperature?: number;
  maxTokens?: number;
  /** Ask the model to expose its reasoning/chain-of-thought (opt-in, `--think`). */
  reasoning?: boolean;
}

export interface ChatRequest {
  messages: Message[];
  /** Native-tool providers receive these; emulated path encodes them into the prompt instead. */
  tools?: ToolSpec[];
  params?: ChatParams;
  /** Abort the in-flight request (e.g. user pressed ESC). */
  signal?: AbortSignal;
  /**
   * When provided, the provider streams the response and calls this for each
   * text chunk as it arrives, while still returning the final aggregated
   * ChatResponse. Providers without streaming support ignore it.
   */
  onDelta?: (textChunk: string) => void;
  /**
   * When provided and the model emits reasoning, the provider streams reasoning
   * chunks here (separate from `onDelta`'s answer text). Providers/models without
   * reasoning ignore it.
   */
  onReasoningDelta?: (textChunk: string) => void;
}

export interface Usage {
  promptTokens?: number;
  completionTokens?: number;
}

export interface ChatResponse {
  content: string;
  toolCalls: ToolCall[];
  finishReason: string;
  usage?: Usage;
}

export interface Provider {
  readonly name: string;
  readonly model: string;
  chat(req: ChatRequest): Promise<ChatResponse>;
}
