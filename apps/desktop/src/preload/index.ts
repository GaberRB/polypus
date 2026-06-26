import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import {
  IPC,
  type ChatMessage,
  type ConfigSnapshot,
  type DirEntry,
  type EstimateResult,
  type LoadedSession,
  type McpServerEntry,
  type McpToolInfo,
  type Mode,
  type ModelPrice,
  type OpenRouterModel,
  type RecentProject,
  type Result,
  type ReviewResult,
  type RunResult,
  type SaveAgentInput,
  type SessionSummary,
  type StreamEvent,
} from "../shared/ipc";

/**
 * Typed bridge exposed to the renderer as `window.polypus`. v1 (#114) covers the
 * headless JSON commands (estimate/review/run); more surfaces (agents, sessions,
 * usage, retrieval) and live streaming follow once core is consumed as a library.
 */
const api = {
  /** Sanity check that the preload bridge is wired. */
  ping: (): string => "pong",
  /** App version, for the about/footer. */
  version: process.env.npm_package_version ?? "0.1.0",

  /** Estimate effort/cost for a task (`polypus estimate --json`). */
  estimate: (task: string): Promise<Result<EstimateResult>> =>
    ipcRenderer.invoke(IPC.estimate, task),
  /** Review a PR diff (`polypus review --json`). */
  review: (pr: string): Promise<Result<ReviewResult>> => ipcRenderer.invoke(IPC.review, pr),
  /** Run a task headless in the given permission mode (`polypus run --json`). */
  run: (task: string, mode: Mode): Promise<Result<RunResult>> =>
    ipcRenderer.invoke(IPC.run, task, mode),

  /** Build/update the repo's semantic index (`polypus index`). Returns its status text. */
  index: (dir?: string): Promise<Result<string>> => ipcRenderer.invoke(IPC.index, dir),
  /** Query the index for relevant chunks (`polypus retrieve <query>`). */
  retrieve: (query: string, dir?: string): Promise<Result<string>> =>
    ipcRenderer.invoke(IPC.retrieve, query, dir),

  /** Recently opened project folders (in-process via the core lib). */
  recentProjects: (): Promise<Result<RecentProject[]>> => ipcRenderer.invoke(IPC.recentList),
  addRecentProject: (path: string): Promise<Result<void>> =>
    ipcRenderer.invoke(IPC.recentAdd, path),
  /** Saved sessions for the given project dir (omit to get all). */
  sessions: (projectDir?: string): Promise<Result<SessionSummary[]>> =>
    ipcRenderer.invoke(IPC.sessionsList, projectDir),

  /**
   * Run a task with live NDJSON streaming (`run --json --stream`). Calls `onEvent`
   * for each event (step, assistant_delta, tool_call/result, …, result, end,
   * error). Returns an unsubscribe to detach the listener.
   */
  runStream(task: string, mode: Mode, onEvent: (e: StreamEvent) => void, dir?: string, resumeSessionId?: string): () => void {
    const listener = (_e: IpcRendererEvent, ev: StreamEvent): void => onEvent(ev);
    ipcRenderer.on(IPC.runEvent, listener);
    ipcRenderer.send(IPC.runStart, { task, mode, dir, resumeSessionId });
    return () => ipcRenderer.removeListener(IPC.runEvent, listener);
  },

  stopRun: (): void => ipcRenderer.send(IPC.runStop),

  // Settings / model picker / folder picker (#112).
  getConfig: (): Promise<Result<ConfigSnapshot>> => ipcRenderer.invoke(IPC.configGet),
  saveAgent: (input: SaveAgentInput): Promise<Result<void>> =>
    ipcRenderer.invoke(IPC.configSaveAgent, input),
  setDefaultAgent: (name: string): Promise<Result<void>> =>
    ipcRenderer.invoke(IPC.configSetDefault, name),
  listModels: (): Promise<Result<OpenRouterModel[]>> => ipcRenderer.invoke(IPC.modelsList),
  chooseFolder: (): Promise<Result<string | undefined>> => ipcRenderer.invoke(IPC.dialogFolder),
  chat: (messages: ChatMessage[]): Promise<Result<string>> => ipcRenderer.invoke(IPC.chatSend, messages),
  testAgent: (name: string): Promise<Result<{ ok: boolean; message: string }>> =>
    ipcRenderer.invoke(IPC.configTestAgent, name),

  // MCP server management — reads/writes .poly/mcp.json in the project dir.
  mcpList: (dir: string): Promise<Result<McpServerEntry[]>> => ipcRenderer.invoke(IPC.mcpList, dir),
  mcpSave: (dir: string, servers: McpServerEntry[]): Promise<Result<void>> =>
    ipcRenderer.invoke(IPC.mcpSave, dir, servers),
  mcpTestServer: (entry: McpServerEntry): Promise<Result<McpToolInfo[]>> =>
    ipcRenderer.invoke(IPC.mcpTestServer, entry),

  // Session management — delete and load full session record.
  deleteSession: (id: string): Promise<Result<void>> => ipcRenderer.invoke(IPC.sessionDelete, id),
  loadSession: (id: string): Promise<Result<LoadedSession | undefined>> =>
    ipcRenderer.invoke(IPC.sessionLoad, id),

  // Filesystem — list directory entries and read file content.
  dirList: (absPath: string): Promise<Result<DirEntry[]>> => ipcRenderer.invoke(IPC.dirList, absPath),
  fileRead: (absPath: string): Promise<Result<string>> => ipcRenderer.invoke(IPC.fileRead, absPath),

  // Model pricing — returns price-per-million-tokens for the active model, or null.
  getModelPrice: (): Promise<Result<ModelPrice | null>> => ipcRenderer.invoke(IPC.modelPrice),
};

export type PolypusApi = typeof api;

contextBridge.exposeInMainWorld("polypus", api);
