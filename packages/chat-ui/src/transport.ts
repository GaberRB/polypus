/**
 * Transport contract (T2) — the single seam between the chat UI and whatever
 * host drives the Polypus CLI. The desktop app implements it over Electron IPC
 * (`window.polypus`); the VSCode extension implements it over webview
 * `postMessage`. The UI components never touch a host API directly — they only
 * speak `ChatTransport`, so the same reducer/components run in both shells.
 */

/**
 * A streamed run event. Mirrors the CLI's `run --json --stream` NDJSON output
 * (`src/cli/commands/json-output.ts`) plus the host's own terminal `end`/`error`
 * events. Kept structural (`[key: string]: unknown`) so new event fields don't
 * break the contract.
 */
export interface StreamEvent {
  type:
    | "session_start"
    | "step"
    | "assistant_delta"
    | "thinking_delta"
    | "assistant"
    | "tool_call"
    | "tool_result"
    | "ask_user"
    | "correction"
    | "reprompt"
    | "compaction"
    | "usage"
    | "result"
    | "end"
    | "error";
  /** Present on `session_start` — reuse as resumeSessionId for follow-ups. */
  sessionId?: string;
  /** Present on `assistant`/`assistant_delta`/`error` (as message). */
  text?: string;
  message?: string;
  /** Present on `tool_call`/`tool_result`. */
  name?: string;
  arguments?: unknown;
  ok?: boolean;
  output?: string;
  /** Present on `usage` — cumulative tokens for the run. */
  promptTokens?: number;
  completionTokens?: number;
  /** Present on `ask_user` — a choice prompt the UI renders as a card. */
  id?: number;
  question?: string;
  options?: string[];
  multi?: boolean;
  [key: string]: unknown;
}

/** Permission mode for a run (mirrors the CLI's PermissionMode). */
export type Mode = "plan" | "review" | "bypass";

/** Execution profile — discrete levels the CLI exposes (no continuous slider). */
export type Profile = "fast" | "quality";

/** Everything the user can tune for a run, surfaced as panel controls. */
export interface RunControls {
  mode: Mode;
  /** Configured agent name (`--agent`); undefined = default agent. */
  agent?: string;
  /** Execution profile (`--fast`/`--quality`); undefined = config default. */
  profile?: Profile;
  /** Stream the model's reasoning/chain-of-thought (`--think`). */
  thinking?: boolean;
  /** Override the agent's model with a specific OpenRouter model id (`--model`). */
  model?: string;
}

/** An OpenRouter catalog model, for the model browser. Prices are per 1M tokens. */
export interface OpenRouterModelInfo {
  id: string;
  name: string;
  promptPrice: number;
  completionPrice: number;
  contextLength: number;
  supportsTools: boolean;
  free: boolean;
}

/** Per-million-token prices for the active model, for live cost estimation. */
export interface ModelPrice {
  promptPrice: number;
  completionPrice: number;
}

/** A file entry for the `@`-mention picker. */
export interface FileEntry {
  name: string;
  path: string;
}

/** A configured agent, for the model switcher. */
export interface AgentInfo {
  name: string;
  provider: string;
  model: string;
  isDefault: boolean;
}

/**
 * Everything the chat UI needs from its host. Each method is host-agnostic: the
 * desktop binds these to Electron IPC, the extension to webview messaging.
 */
export interface ChatTransport {
  /**
   * Start a run. The host spawns `run --json --stream` and pushes each event to
   * `onEvent`. Returns an unsubscribe that also signals the host to stop
   * forwarding. `resumeSessionId` continues a prior session.
   */
  runStream(
    task: string,
    controls: RunControls,
    onEvent: (ev: StreamEvent) => void,
    opts?: { resumeSessionId?: string },
  ): () => void;

  /** List the configured agents (for the model switcher). */
  listAgents(): Promise<AgentInfo[]>;

  /** Search the OpenRouter catalog (for the model browser). */
  searchModels(query: string): Promise<OpenRouterModelInfo[]>;

  /**
   * Fork `sessionId` truncated to its first `keepUserTurns` user turns
   * (non-destructive). Returns the new session id to resume from, or null.
   */
  rewind(sessionId: string, keepUserTurns: number): Promise<string | null>;

  /** Answer a pending `ask_user` card (selected = null when dismissed). */
  respondAsk(id: number, selected: string[] | null): void;

  /** Cancel the active run (host kills the child process). */
  stopRun(): void;

  /** Price of the active model, or null when unknown. */
  getModelPrice(): Promise<ModelPrice | null>;

  /** List files in the workspace for the `@`-mention picker. */
  listFiles(query: string): Promise<FileEntry[]>;

  /** Read a file's contents (for inlining an `@`-mention). */
  readFile(path: string): Promise<string>;
}
