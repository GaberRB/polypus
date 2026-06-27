/**
 * Wire protocol between the extension host and the webview, sent over
 * `postMessage`. Request/response calls (model price, file ops) carry a
 * correlation `rpcId`; the run stream is fire-and-forward via `event`.
 */
import type { StreamEvent, Mode, ModelPrice, FileEntry } from "@gaberrb/polypus-chat-ui";

/** Messages the webview sends to the host. */
export type WebviewToHost =
  | { type: "ready" }
  | { type: "run"; task: string; mode: Mode; resumeSessionId?: string }
  | { type: "stop" }
  | { type: "respondAsk"; id: number; selected: string[] | null }
  | { type: "rpc"; rpcId: number; method: "getModelPrice" }
  | { type: "rpc"; rpcId: number; method: "listFiles"; query: string }
  | { type: "rpc"; rpcId: number; method: "readFile"; path: string }
  | { type: "setApiKey" };

/** Messages the host sends to the webview. */
export type HostToWebview =
  | { type: "event"; event: StreamEvent }
  | { type: "rpcResult"; rpcId: number; ok: true; data: ModelPrice | null | FileEntry[] | string }
  | { type: "rpcResult"; rpcId: number; ok: false; error: string }
  | { type: "init"; hasProject: boolean; hasKey: boolean; mode: Mode; model?: string };

export type { StreamEvent, Mode, ModelPrice, FileEntry };
