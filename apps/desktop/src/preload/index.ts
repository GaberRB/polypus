import { contextBridge, ipcRenderer } from "electron";
import {
  IPC,
  type EstimateResult,
  type Mode,
  type Result,
  type ReviewResult,
  type RunResult,
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
};

export type PolypusApi = typeof api;

contextBridge.exposeInMainWorld("polypus", api);
