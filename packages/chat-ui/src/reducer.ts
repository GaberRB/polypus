/**
 * Pure stream → messages reducer (T3). Extracted from the desktop `Chat.tsx`
 * `handle()` switch so the exact same logic drives both the desktop app and the
 * VSCode extension. No host APIs, no React — just `(messages, event) => messages`,
 * which makes it trivially testable and impossible to garble mid-stream.
 */
import type { StreamEvent } from "./transport.js";

export interface ToolItem {
  name: string;
  arg?: string;
  ok?: boolean;
  output?: string;
}

export interface AskPrompt {
  id: number;
  question: string;
  options: string[];
  multi: boolean;
  /** Set once the user answers — locks the card. */
  answered?: string[];
}

export type Msg =
  | { id: number; role: "user"; text: string }
  | {
      id: number;
      role: "agent";
      text: string;
      /** Streamed reasoning/chain-of-thought (when `--think` is on). */
      thinking: string;
      tools: ToolItem[];
      asks: AskPrompt[];
      done: boolean;
    }
  | { id: number; role: "error"; text: string };

/** Cumulative token totals surfaced by `usage` events. */
export interface Usage {
  promptTokens: number;
  completionTokens: number;
}

export interface ChatState {
  messages: Msg[];
  usage: Usage;
  /** Session id from `session_start`, used to resume on follow-ups. */
  sessionId?: string;
  /** True while a run is streaming (no terminal `end` yet). */
  running: boolean;
}

export function initialState(seed?: { messages?: Msg[]; sessionId?: string }): ChatState {
  return {
    messages: seed?.messages ?? [],
    usage: { promptTokens: 0, completionTokens: 0 },
    sessionId: seed?.sessionId,
    running: false,
  };
}

/** Derive the `@`-mention-friendly arg label from a tool call's arguments. */
function deriveArg(args: unknown): string | undefined {
  if (!args || typeof args !== "object") return undefined;
  const a = args as Record<string, unknown>;
  const v = a.command ?? a.path ?? a.query;
  return typeof v === "string" ? v : undefined;
}

/** Immutably patch the in-flight agent message identified by `agentId`. */
function patchAgent(
  messages: Msg[],
  agentId: number,
  fn: (m: Extract<Msg, { role: "agent" }>) => Extract<Msg, { role: "agent" }>,
): Msg[] {
  return messages.map((m) => (m.id === agentId && m.role === "agent" ? fn(m) : m));
}

/**
 * Apply one stream event to the chat state, targeting the in-flight agent
 * message `agentId`. Returns a new state (never mutates). `nextErrorId` mints
 * ids for synthetic error messages.
 */
export function reduce(
  state: ChatState,
  agentId: number,
  ev: StreamEvent,
  nextErrorId: () => number,
): ChatState {
  switch (ev.type) {
    case "session_start":
      return ev.sessionId ? { ...state, sessionId: ev.sessionId } : state;

    case "thinking_delta":
      return {
        ...state,
        messages: patchAgent(state.messages, agentId, (m) => ({ ...m, thinking: m.thinking + String(ev.text ?? "") })),
      };

    case "assistant_delta":
      return {
        ...state,
        messages: patchAgent(state.messages, agentId, (m) => ({ ...m, text: m.text + String(ev.text ?? "") })),
      };

    case "assistant":
      // Full text only fills in when nothing streamed live (avoid double print).
      return {
        ...state,
        messages: patchAgent(state.messages, agentId, (m) => (m.text ? m : { ...m, text: String(ev.text ?? "") })),
      };

    case "tool_call":
      return {
        ...state,
        messages: patchAgent(state.messages, agentId, (m) => ({
          ...m,
          tools: [...m.tools, { name: String(ev.name ?? "tool"), arg: deriveArg(ev.arguments) }],
        })),
      };

    case "tool_result":
      return {
        ...state,
        messages: patchAgent(state.messages, agentId, (m) => {
          const tools = [...m.tools];
          // Attach the result to the most recent still-pending tool row.
          for (let i = tools.length - 1; i >= 0; i--) {
            if (tools[i]!.ok === undefined) {
              tools[i] = { ...tools[i]!, ok: Boolean(ev.ok), output: String(ev.output ?? "") };
              break;
            }
          }
          return { ...m, tools };
        }),
      };

    case "ask_user":
      if (typeof ev.id === "number" && Array.isArray(ev.options)) {
        const ask: AskPrompt = {
          id: ev.id,
          question: String(ev.question ?? ""),
          options: ev.options.map((o) => String(o)),
          multi: Boolean(ev.multi),
        };
        return {
          ...state,
          messages: patchAgent(state.messages, agentId, (m) => ({ ...m, asks: [...m.asks, ask] })),
        };
      }
      return state;

    case "usage":
      return {
        ...state,
        usage: {
          promptTokens: ev.promptTokens !== undefined ? Number(ev.promptTokens) : state.usage.promptTokens,
          completionTokens:
            ev.completionTokens !== undefined ? Number(ev.completionTokens) : state.usage.completionTokens,
        },
      };

    case "result":
      return {
        ...state,
        messages: patchAgent(state.messages, agentId, (m) => ({ ...m, done: true })),
      };

    case "error":
      return {
        ...state,
        messages: [...state.messages, { id: nextErrorId(), role: "error", text: String(ev.message ?? ev.text ?? "erro") }],
      };

    case "end":
      return { ...state, running: false };

    default:
      return state;
  }
}

/** Lock a choice card once the user answers it. */
export function lockAsk(messages: Msg[], agentId: number, askId: number, selected: string[]): Msg[] {
  return patchAgent(messages, agentId, (m) => ({
    ...m,
    asks: m.asks.map((a) => (a.id === askId ? { ...a, answered: selected } : a)),
  }));
}

/** True when any agent message is blocked on an unanswered choice card. */
export function hasPendingAsk(messages: Msg[]): boolean {
  return messages.some((m) => m.role === "agent" && m.asks.some((a) => !a.answered));
}
