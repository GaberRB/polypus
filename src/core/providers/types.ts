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
}

export interface ChatRequest {
  messages: Message[];
  /** Native-tool providers receive these; emulated path encodes them into the prompt instead. */
  tools?: ToolSpec[];
  params?: ChatParams;
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
