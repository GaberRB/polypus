/**
 * Shared IPC contract between the Electron main process and the renderer.
 * v1 of the bridge (#114) reuses Polypus' headless JSON commands — the main
 * process spawns the CLI and returns parsed JSON. Live token streaming and the
 * remaining surfaces (agents, sessions, usage, retrieval) come once `src/core`
 * is consumed as a library; see #112.
 */

/** Permission mode for a run (mirrors src/core PermissionMode). */
export type Mode = "plan" | "review" | "bypass";

/** Channel names (kept here so main/preload can't drift). */
export const IPC = {
  estimate: "polypus:estimate",
  review: "polypus:review",
  run: "polypus:run",
  index: "polypus:index",
  retrieve: "polypus:retrieve",
  recentList: "polypus:recent:list",
  recentAdd: "polypus:recent:add",
  sessionsList: "polypus:sessions:list",
  runStart: "polypus:run:start",
  runStop: "polypus:run:stop",
  runEvent: "polypus:run:event",
  configGet: "polypus:config:get",
  configSaveAgent: "polypus:config:saveAgent",
  configSetDefault: "polypus:config:setDefault",
  modelsList: "polypus:models:list",
  dialogFolder: "polypus:dialog:folder",
  chatSend: "polypus:chat:send",
  configTestAgent: "polypus:config:testAgent",
  mcpList: "polypus:mcp:list",
  mcpSave: "polypus:mcp:save",
  mcpTestServer: "polypus:mcp:test",
  sessionDelete: "polypus:session:delete",
  sessionLoad: "polypus:session:load",
  dirList: "polypus:dir:list",
  fileRead: "polypus:file:read",
  modelPrice: "polypus:model:price",
} as const;

/** A plain chat message (Chat tab — no tools, no filesystem). */
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/** A configured agent (no raw key — `hasKey` tells the UI if one is set). */
export interface Agent {
  name: string;
  provider: string;
  model: string;
  baseUrl?: string;
  toolMode: string;
  hasKey: boolean;
}

export interface ConfigSnapshot {
  agents: Agent[];
  defaultAgent?: string;
}

/** What Settings sends to create/update an agent (apiKey is the raw key). */
export interface SaveAgentInput {
  name: string;
  provider: string;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  setDefault?: boolean;
}

/** An OpenRouter catalog model (mirrors src/core OpenRouterModel). */
export interface OpenRouterModel {
  id: string;
  name: string;
  promptPrice: number;
  completionPrice: number;
  contextLength: number;
  supportsTools: boolean;
  free: boolean;
  popularity: number;
}

/**
 * A streamed run event (from `run --json --stream`), plus the bridge's own
 * `end`/`error` terminal events. Mirrors src/cli StreamEvent.
 */
export interface StreamEvent {
  type:
    | "session_start"
    | "step"
    | "assistant_delta"
    | "assistant"
    | "tool_call"
    | "tool_result"
    | "hook_event"
    | "correction"
    | "reprompt"
    | "compaction"
    | "usage"
    | "result"
    | "end"
    | "error";
  /** Present on type: "hook_event" */
  event?: "PreToolUse" | "PostToolUse" | "Stop";
  toolName?: string | null;
  command?: string;
  durationMs?: number;
  blocked?: boolean;
  /** Present on type: "session_start" — use as resumeSessionId for follow-ups. */
  sessionId?: string;
  /** Populated on `type: "usage"` — cumulative tokens for this run. */
  promptTokens?: number;
  completionTokens?: number;
  [key: string]: unknown;
}

/** Pricing for the active model (per-million-token prices from OpenRouter). */
export interface ModelPrice {
  promptPrice: number;
  completionPrice: number;
}

/** A recently opened project folder (mirrors src/core recent-projects). */
export interface RecentProject {
  path: string;
  lastOpenedAt: string;
}

/** A saved session summary (mirrors src/core SessionSummary). */
export interface SessionSummary {
  id: string;
  updatedAt: string;
  title: string;
  agentName: string;
  mode: string;
  messageCount: number;
  projectDir?: string;
}

/** Every bridge call resolves to a Result so the renderer never sees a throw. */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** A full session record as returned by sessionLoad (mirrors src/core SessionRecord). */
export interface LoadedSession {
  id: string;
  title: string;
  agentName: string;
  mode: string;
  updatedAt: string;
  messages: Array<{ role: string; content: string | unknown[] }>;
}

/** A directory entry returned by dirList. */
export interface DirEntry {
  name: string;
  type: "file" | "dir";
  path: string;
}

/** A single MCP server entry as stored in .poly/mcp.json. */
export interface McpServerEntry {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
}

/** A tool exposed by an MCP server (returned by mcpTestServer). */
export interface McpToolInfo {
  server: string;
  name: string;
  description?: string;
}

/** Shape of `polypus estimate --json`. */
export interface EstimateResult {
  estimate?: {
    complexity?: string;
    estimatedSteps?: number;
    estimatedTokens?: number;
    costLabel?: string;
    rationale?: string;
    risks?: string;
  };
}

/** Shape of `polypus run --json`. */
export interface RunResult {
  result?: {
    reason: string;
    steps: number;
    filesChanged?: string[];
  };
}

/** A single review finding (mirrors src/core/agent/review.ts). */
export interface ReviewFinding {
  file?: string;
  issue: string;
}

/** Shape of `polypus review --json`. */
export interface ReviewResult {
  blocking: ReviewFinding[];
  warnings: ReviewFinding[];
  suggestions: ReviewFinding[];
}
