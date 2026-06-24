import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import {
  AgentConfig,
  DEFAULT_CONFIG,
  PolypusConfig,
  type ProviderKind,
  type ToolMode,
} from "./schema.js";
import { t } from "../i18n/index.js";

/** Directory where Polypus keeps its config. Override with POLYPUS_HOME. */
export function configDir(): string {
  return process.env.POLYPUS_HOME ?? join(homedir(), ".polypus");
}

export function configPath(): string {
  return join(configDir(), "config.json");
}

/** Load config from disk, falling back to defaults if it does not exist yet. */
export async function loadConfig(): Promise<PolypusConfig> {
  const path = configPath();
  if (!existsSync(path)) return structuredClone(DEFAULT_CONFIG);
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path, "utf8"));
  } catch (err) {
    throw new Error(
      `Failed to parse config at ${path}: ${(err as Error).message}`,
    );
  }
  const parsed = PolypusConfig.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Invalid config at ${path}:\n${parsed.error.issues
        .map((i) => `  - ${i.path.join(".") || "<root>"}: ${i.message}`)
        .join("\n")}`,
    );
  }
  return parsed.data;
}

/** Persist config to disk (pretty-printed), creating the directory if needed. */
export async function saveConfig(config: PolypusConfig): Promise<void> {
  await mkdir(configDir(), { recursive: true });
  const validated = PolypusConfig.parse(config);
  await writeFile(configPath(), JSON.stringify(validated, null, 2) + "\n", "utf8");
}

export function findAgent(
  config: PolypusConfig,
  name: string,
): AgentConfig | undefined {
  return config.agents.find((a) => a.name === name);
}

export interface UpsertAgentInput {
  name: string;
  provider: ProviderKind;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  toolMode?: ToolMode;
  setDefault?: boolean;
}

/**
 * Add or replace an agent by name (validated via the schema). Sets it as the
 * default when asked or when it's the only agent. Mutates and returns `config`
 * (caller persists with `saveConfig`). Shared by the CLI and host UIs (Cowork).
 */
export function upsertAgent(config: PolypusConfig, input: UpsertAgentInput): PolypusConfig {
  const agent = AgentConfig.parse({
    name: input.name,
    provider: input.provider,
    model: input.model,
    apiKey: input.apiKey,
    baseUrl: input.baseUrl,
    toolMode: input.toolMode ?? "auto",
  });
  const idx = config.agents.findIndex((a) => a.name === agent.name);
  if (idx === -1) config.agents.push(agent);
  else config.agents[idx] = agent;
  if (input.setDefault || config.agents.length === 1) config.defaultAgent = agent.name;
  return config;
}

/**
 * Resolve the agent to use: explicit name → default → the only agent.
 * Throws a helpful error otherwise.
 */
export function resolveAgent(
  config: PolypusConfig,
  name?: string,
): AgentConfig {
  if (name) {
    const agent = findAgent(config, name);
    if (!agent) {
      throw new Error(
        t("agent.noneKnown", {
          name,
          names: config.agents.map((a) => a.name).join(", ") || "(none)",
        }),
      );
    }
    return agent;
  }
  if (config.defaultAgent) {
    const agent = findAgent(config, config.defaultAgent);
    if (agent) return agent;
  }
  if (config.agents.length === 1) return config.agents[0]!;
  if (config.agents.length === 0) {
    throw new Error(t("agent.noneConfigured"));
  }
  throw new Error(
    t("agent.multipleNoDefault", { names: config.agents.map((a) => a.name).join(", ") }),
  );
}

/**
 * Resolve a configured secret value. Supports "${ENV_VAR}" references so that
 * keys are not stored inline. Returns undefined when nothing is configured.
 */
export function resolveSecret(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const match = /^\$\{([A-Z0-9_]+)\}$/i.exec(value.trim());
  if (match) {
    const env = process.env[match[1]!];
    if (!env) {
      throw new Error(
        `Config references env var ${match[1]} but it is not set in the environment.`,
      );
    }
    return env;
  }
  return value;
}
