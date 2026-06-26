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
  deleteSession,
  type SessionSummary,
  type SessionRecord,
} from "./core/agent/session-store.js";

export {
  loadConfig,
  saveConfig,
  configDir,
  findAgent,
  resolveSecret,
  upsertAgent,
  type UpsertAgentInput,
} from "./core/config/store.js";

export { setEnvVar } from "./core/config/dotenv.js";

export { testConnection } from "./core/providers/health.js";

export { chatOnce } from "./core/agent/chat.js";

export type { Message } from "./core/providers/types.js";

export {
  listOpenRouterModels,
  filterModels,
  fmtPrice,
  fmtContext,
  type OpenRouterModel,
  type ModelFilter,
  type ModelSort,
} from "./core/providers/openrouter.js";

export {
  DEFAULT_BASE_URL,
  REQUIRES_API_KEY,
  SUGGESTED_KEY_ENV,
} from "./core/providers/defaults.js";

export type {
  AgentConfig,
  PolypusConfig,
  ProviderKind,
  PermissionMode,
} from "./core/config/schema.js";

export { McpClient, type McpToolDef } from "./core/mcp/client.js";
export { type McpServerConfig, type LoadedMcp } from "./core/mcp/index.js";
