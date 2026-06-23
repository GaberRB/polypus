/**
 * Public library surface for embedders of Polypus (e.g. the Cowork desktop app).
 * Re-exports the core APIs a host UI needs so it can call them in-process instead
 * of shelling out to the CLI. Imported as `@gaberrb/polypus/lib`.
 */

export {
  addRecentProject,
  listRecentProjects,
  removeRecentProject,
  type RecentProject,
} from "./core/config/recent-projects.js";

export { gitInfo, type GitInfo } from "./core/util/git-info.js";

export {
  listSessions,
  loadSession,
  latestSession,
  type SessionSummary,
  type SessionRecord,
} from "./core/agent/session-store.js";

export { loadConfig, configDir } from "./core/config/store.js";

export { testConnection } from "./core/providers/health.js";

export type {
  AgentConfig,
  PolypusConfig,
  ProviderKind,
  PermissionMode,
} from "./core/config/schema.js";
