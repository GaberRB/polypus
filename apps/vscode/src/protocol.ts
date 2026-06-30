/**
 * Wire protocol between the extension host and the webview, sent over
 * `postMessage`. Request/response calls (model price, file ops) carry a
 * correlation `rpcId`; the run stream is fire-and-forward via `event`.
 */
import type {
  StreamEvent,
  Mode,
  RunControls,
  ModelPrice,
  FileEntry,
  AgentInfo,
  OpenRouterModelInfo,
} from "@gaberrb/polypus-chat-ui";

// Custom provider payload (mirrors CustomProviderConfig from core schema)
export interface CustomProviderPayload {
  name: string;
  auth:
    | { type: "none" }
    | { type: "api-key"; headerName: string; apiKey: string }
    | {
        type: "oauth2-client-credentials";
        tokenUrl: string;
        clientId: string;
        clientSecret: string;
        grantType: string;
        tokenHeaders: Record<string, string>;
        tokenParams: Record<string, string>;
        tokenPath: string;
        expiresPath?: string;
      };
  chat: {
    url: string;
    method: string;
    headers: Record<string, string>;
    bodyTemplate: string;
  };
  responsePath: string;
  sessionPath?: string;
  params: Record<string, string>;
  safetyMode: "bypass" | "read-only" | "review";
}

export interface CustomProviderInfo {
  name: string;
  authType: string;
  safetyMode: string;
}

export interface OpenRouterKeyStatus {
  set: boolean;
  /** Masked preview, e.g. "sk-or-…abc" */
  preview?: string;
}

/** Messages the webview sends to the host. */
export type WebviewToHost =
  | { type: "ready" }
  | { type: "run"; task: string; controls: RunControls; resumeSessionId?: string }
  | { type: "stop" }
  | { type: "respondAsk"; id: number; selected: string[] | null }
  | { type: "respondConfirm"; id: number; ok: boolean }
  | { type: "rpc"; rpcId: number; method: "getModelPrice" }
  | { type: "rpc"; rpcId: number; method: "listFiles"; query: string }
  | { type: "rpc"; rpcId: number; method: "readFile"; path: string }
  | { type: "rpc"; rpcId: number; method: "listAgents" }
  | { type: "rpc"; rpcId: number; method: "rewind"; sessionId: string; keepUserTurns: number }
  | { type: "rpc"; rpcId: number; method: "searchModels"; query: string }
  | { type: "rpc"; rpcId: number; method: "addAgent"; modelId: string }
  | { type: "rpc"; rpcId: number; method: "removeAgent"; name: string }
  | { type: "rpc"; rpcId: number; method: "listCustomProviders" }
  | { type: "rpc"; rpcId: number; method: "addCustomProvider"; payload: CustomProviderPayload }
  | { type: "rpc"; rpcId: number; method: "removeCustomProvider"; name: string }
  | { type: "rpc"; rpcId: number; method: "testCustomProvider"; payload: CustomProviderPayload }
  | { type: "rpc"; rpcId: number; method: "getEditorSelection" }
  | { type: "setApiKey" }
  | { type: "clearApiKey" };

/** Messages the host sends to the webview. */
export type HostToWebview =
  | { type: "event"; event: StreamEvent }
  | {
      type: "rpcResult";
      rpcId: number;
      ok: true;
      data:
        | ModelPrice
        | null
        | FileEntry[]
        | AgentInfo[]
        | OpenRouterModelInfo[]
        | CustomProviderInfo[]
        | string;
    }
  | { type: "rpcResult"; rpcId: number; ok: false; error: string }
  | { type: "init"; hasProject: boolean; hasKey: boolean; mode: Mode; model?: string };

export type { StreamEvent, Mode, RunControls, ModelPrice, FileEntry, AgentInfo, OpenRouterModelInfo };
