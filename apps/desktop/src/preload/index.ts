import { contextBridge } from "electron";

/**
 * Typed bridge exposed to the renderer as `window.polypus`. This is just a
 * placeholder surface — the real core<->UI API (run/streaming, agents, sessions,
 * retrieval, …) lands in #114, reusing `src/core` over IPC.
 */
const api = {
  /** Sanity check that the preload bridge is wired. */
  ping: (): string => "pong",
  /** App version, for the about/footer. */
  version: process.env.npm_package_version ?? "0.1.0",
};

export type PolypusApi = typeof api;

contextBridge.exposeInMainWorld("polypus", api);
