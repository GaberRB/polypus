/** Tipos compartilhados entre background, popup e side panel */

export type PermissionMode = "plan" | "review" | "bypass";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export type WebActionName =
  | "web_navigate"
  | "web_click"
  | "web_type"
  | "web_extract"
  | "web_scroll"
  | "web_screenshot"
  | "web_get_html"
  | "web_wait"
  | "web_execute";

export interface WebAction {
  id: string;
  tool: WebActionName;
  args: Record<string, unknown>;
  status: "pending" | "running" | "done" | "error";
  target?: string; // CSS selector or URL
  result?: string;
  error?: string;
  timestamp: number;
}

/** Eventos do stream NDJSON (mesmo formato de runBridge.ts / protocol.ts) */
export type StreamEvent =
  | { type: "session_start"; sessionId: string }
  | { type: "step"; step: number }
  | { type: "assistant_delta"; text: string }
  | { type: "tool_call"; tool: string; args: Record<string, unknown>; id: string }
  | { type: "tool_result"; tool: string; ok: boolean; output: string; id: string }
  | { type: "ask_user"; id: number; question: string; options: string[]; multi?: boolean }
  | { type: "confirm_request"; id: number; action: string; target?: string; summary: string }
  | { type: "usage"; tokensIn: number; tokensOut: number; costUsd: number }
  | { type: "error"; message: string }
  | { type: "end"; code?: number };

/** Comandos enviados ao WebSocket do CLI */
export type WsCommand =
  | { type: "run"; task: string; mode?: PermissionMode; agent?: string }
  | { type: "stop" }
  | { type: "respond_ask"; id: number; selected: string[] | null }
  | { type: "respond_confirm"; id: number; approved: boolean };

/** Mensagens entre background e UI (chrome.runtime.sendMessage) */
export type BgToUi =
  | { type: "status"; status: ConnectionStatus }
  | { type: "event"; event: StreamEvent }
  | { type: "actions"; actions: WebAction[] }
  | { type: "session"; sessionId: string | null };

export type UiToBg =
  | { type: "run"; task: string; mode: PermissionMode }
  | { type: "stop" }
  | { type: "respond_ask"; id: number; selected: string[] | null }
  | { type: "respond_confirm"; id: number; approved: boolean }
  | { type: "get_status" };

export interface WebPermissions {
  mode: PermissionMode;
  allowList: string[];
  blockList: string[];
}

export interface AppState {
  status: ConnectionStatus;
  sessionId: string | null;
  actions: WebAction[];
  events: StreamEvent[];
  permissions: WebPermissions;
  error?: string;
}