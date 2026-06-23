import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import {
  IPC,
  type EstimateResult,
  type Mode,
  type RecentProject,
  type Result,
  type ReviewResult,
  type RunResult,
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
  /** Saved sessions that can be resumed. */
  sessions: (): Promise<Result<SessionSummary[]>> => ipcRenderer.invoke(IPC.sessionsList),

  /**
   * Run a task with live NDJSON streaming (`run --json --stream`). Calls `onEvent`
   * for each event (step, assistant_delta, tool_call/result, …, result, end,
   * error). Returns an unsubscribe to detach the listener.
   */
  runStream(task: string, mode: Mode, onEvent: (e: StreamEvent) => void): () => void {
    const listener = (_e: IpcRendererEvent, ev: StreamEvent): void => onEvent(ev);
    ipcRenderer.on(IPC.runEvent, listener);
    ipcRenderer.send(IPC.runStart, { task, mode });
    return () => ipcRenderer.removeListener(IPC.runEvent, listener);
  },
};

export type PolypusApi = typeof api;

contextBridge.exposeInMainWorld("polypus", api);
