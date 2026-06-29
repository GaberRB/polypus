/**
 * Custom provider CRUD — reads/writes ~/.polypus/config.json directly,
 * same as agents.ts, to avoid a runtime dependency on the full CLI lib.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CustomProviderPayload, CustomProviderInfo } from "../protocol.js";

function configPath(): string {
  const dir = process.env.POLYPUS_HOME ?? join(homedir(), ".polypus");
  return join(dir, "config.json");
}

interface RawConfig {
  customProviders?: CustomProviderPayload[];
  [key: string]: unknown;
}

async function readRaw(): Promise<RawConfig> {
  const path = configPath();
  if (!existsSync(path)) return {};
  return JSON.parse(await readFile(path, "utf8")) as RawConfig;
}

async function writeRaw(raw: RawConfig): Promise<void> {
  const path = configPath();
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, JSON.stringify(raw, null, 2) + "\n", "utf8");
}

export async function listCustomProviders(): Promise<CustomProviderInfo[]> {
  const raw = await readRaw();
  return (raw.customProviders ?? []).map((p) => ({
    name: p.name,
    authType: p.auth.type,
    safetyMode: p.safetyMode,
  }));
}

export async function addCustomProvider(payload: CustomProviderPayload): Promise<void> {
  const raw = await readRaw();
  const providers = raw.customProviders ?? [];
  const idx = providers.findIndex((p) => p.name === payload.name);
  if (idx === -1) providers.push(payload);
  else providers[idx] = payload;
  raw.customProviders = providers;
  await writeRaw(raw);
}

export async function removeCustomProvider(name: string): Promise<void> {
  const raw = await readRaw();
  raw.customProviders = (raw.customProviders ?? []).filter((p) => p.name !== name);
  await writeRaw(raw);
}
