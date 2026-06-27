/**
 * Reads the configured agents straight from the Polypus config file
 * (`$POLYPUS_HOME/config.json` or `~/.polypus/config.json`) — same location the
 * CLI uses (src/core/config/store.ts). Avoids a runtime dependency on the CLI
 * lib just to populate the model switcher (VA3).
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AgentInfo } from "@gaberrb/polypus-chat-ui";

function configPath(): string {
  const dir = process.env.POLYPUS_HOME ?? join(homedir(), ".polypus");
  return join(dir, "config.json");
}

interface RawConfig {
  agents?: Array<{ name?: string; provider?: string; model?: string }>;
  defaultAgent?: string;
}

export async function listConfiguredAgents(): Promise<AgentInfo[]> {
  let raw: RawConfig;
  try {
    raw = JSON.parse(await readFile(configPath(), "utf8")) as RawConfig;
  } catch {
    return []; // no config yet, or unreadable — empty switcher
  }
  return (raw.agents ?? [])
    .filter((a): a is { name: string; provider: string; model: string } =>
      Boolean(a.name && a.provider && a.model),
    )
    .map((a) => ({
      name: a.name,
      provider: a.provider,
      model: a.model,
      isDefault: a.name === raw.defaultAgent,
    }));
}
