/**
 * Webview-side ChatTransport (T5): implements the shared transport contract over
 * VSCode's `postMessage`. Run events stream in via `event` messages; RPC calls
 * (price, file ops) are correlated by `rpcId`.
 */
import type {
  ChatTransport,
  StreamEvent,
  RunControls,
  ModelPrice,
  FileEntry,
  AgentInfo,
  OpenRouterModelInfo,
} from "@gaberrb/polypus-chat-ui";
import type { HostToWebview, WebviewToHost } from "../protocol.js";

interface VsCodeApi {
  postMessage(msg: WebviewToHost): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

const CONFIRM_APPROVE = "✅ Aprovar";
const CONFIRM_DENY = "❌ Negar";

function confirmKindLabel(kind: string): string {
  if (kind === "write") return "✎ Escrever arquivo";
  if (kind === "command") return "⊡ Executar comando";
  return "⬡ Requisição de rede";
}

export class VsCodeTransport implements ChatTransport {
  private readonly vscode = acquireVsCodeApi();
  private onEvent: ((ev: StreamEvent) => void) | null = null;
  private rpcSeq = 0;
  private readonly pending = new Map<number, (msg: Extract<HostToWebview, { type: "rpcResult" }>) => void>();
  /** Tracks ask_user ids that are actually permission confirm requests. */
  private readonly pendingConfirms = new Set<number>();

  constructor() {
    window.addEventListener("message", (e: MessageEvent<HostToWebview>) => {
      const msg = e.data;
      if (msg.type === "event") {
        this.onEvent?.(msg.event);
      } else if (msg.type === "rpcResult") {
        this.pending.get(msg.rpcId)?.(msg);
        this.pending.delete(msg.rpcId);
      }
    });
  }

  /** Tell the host we're mounted so it sends the initial state. */
  ready(): void {
    this.vscode.postMessage({ type: "ready" });
  }

  /** Subscribe to host->webview init/state messages (project/key/mode). */
  onInit(cb: (msg: Extract<HostToWebview, { type: "init" }>) => void): void {
    window.addEventListener("message", (e: MessageEvent<HostToWebview>) => {
      if (e.data.type === "init") cb(e.data);
    });
  }

  requestApiKey(): void {
    this.vscode.postMessage({ type: "setApiKey" });
  }

  runStream(
    task: string,
    controls: RunControls,
    onEvent: (ev: StreamEvent) => void,
    opts?: { resumeSessionId?: string },
  ): () => void {
    this.pendingConfirms.clear();
    this.onEvent = (ev: StreamEvent) => {
      // Convert permission confirm events into ask_user cards so the existing
      // ChoiceCard UI renders them inline without any chat-ui changes.
      if (ev.type === "confirm") {
        const id = ev.id as number;
        const kind = ev.kind as string;
        const summary = ev.summary as string;
        this.pendingConfirms.add(id);
        onEvent({
          type: "ask_user",
          id,
          question: `${confirmKindLabel(kind)}: ${summary}`,
          options: [CONFIRM_APPROVE, CONFIRM_DENY],
          multi: false,
        });
        return;
      }
      onEvent(ev);
    };
    this.vscode.postMessage({ type: "run", task, controls, resumeSessionId: opts?.resumeSessionId });
    return () => {
      this.onEvent = null;
    };
  }

  respondAsk(id: number, selected: string[] | null): void {
    if (this.pendingConfirms.has(id)) {
      // This is a permission confirm masquerading as ask_user — route accordingly.
      this.pendingConfirms.delete(id);
      const ok = selected?.[0] === CONFIRM_APPROVE;
      this.vscode.postMessage({ type: "respondConfirm", id, ok });
    } else {
      this.vscode.postMessage({ type: "respondAsk", id, selected });
    }
  }

  stopRun(): void {
    this.vscode.postMessage({ type: "stop" });
  }

  private rpc<T>(send: (rpcId: number) => WebviewToHost): Promise<T> {
    const rpcId = this.rpcSeq++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(rpcId, (msg) => {
        if (msg.ok) resolve(msg.data as T);
        else reject(new Error(msg.error));
      });
      this.vscode.postMessage(send(rpcId));
    });
  }

  getModelPrice(): Promise<ModelPrice | null> {
    return this.rpc<ModelPrice | null>((rpcId) => ({ type: "rpc", rpcId, method: "getModelPrice" }));
  }

  listFiles(query: string): Promise<FileEntry[]> {
    return this.rpc<FileEntry[]>((rpcId) => ({ type: "rpc", rpcId, method: "listFiles", query }));
  }

  readFile(path: string): Promise<string> {
    return this.rpc<string>((rpcId) => ({ type: "rpc", rpcId, method: "readFile", path }));
  }

  listAgents(): Promise<AgentInfo[]> {
    return this.rpc<AgentInfo[]>((rpcId) => ({ type: "rpc", rpcId, method: "listAgents" }));
  }

  rewind(sessionId: string, keepUserTurns: number): Promise<string | null> {
    return this.rpc<string | null>((rpcId) => ({ type: "rpc", rpcId, method: "rewind", sessionId, keepUserTurns }));
  }

  searchModels(query: string): Promise<OpenRouterModelInfo[]> {
    return this.rpc<OpenRouterModelInfo[]>((rpcId) => ({ type: "rpc", rpcId, method: "searchModels", query }));
  }

  addModelAsAgent(modelId: string): Promise<AgentInfo[]> {
    return this.rpc<AgentInfo[]>((rpcId) => ({ type: "rpc", rpcId, method: "addAgent", modelId }));
  }

  removeAgent(name: string): Promise<AgentInfo[]> {
    return this.rpc<AgentInfo[]>((rpcId) => ({ type: "rpc", rpcId, method: "removeAgent", name }));
  }

  getEditorSelection(): Promise<{ file: string; path: string; text: string } | null> {
    return this.rpc<{ file: string; path: string; text: string } | null>(
      (rpcId) => ({ type: "rpc", rpcId, method: "getEditorSelection" }),
    );
  }
}
