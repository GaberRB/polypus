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

export interface TestResult {
  ok: boolean;
  message: string;
  reply?: string;
}

/**
 * Run a connectivity test in-process (no CLI spawn needed).
 * Uses Node's native fetch to call auth + chat endpoints and reports the exact error.
 */
export async function testCustomProviderInProcess(p: CustomProviderPayload): Promise<TestResult> {
  try {
    // Step 1: auth
    let token: string | undefined;
    if (p.auth.type === "oauth2-client-credentials") {
      const body = new URLSearchParams({
        grant_type: p.auth.grantType ?? "client_credentials",
        client_id: p.auth.clientId,
        client_secret: p.auth.clientSecret,
        ...p.auth.tokenParams,
      });
      const res = await fetch(p.auth.tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          ...p.auth.tokenHeaders,
        },
        body,
      });
      if (!res.ok) {
        const text = await res.text();
        return { ok: false, message: `❌ Auth falhou (${res.status}): ${text}` };
      }
      const data = (await res.json()) as Record<string, unknown>;
      token = String(data["access_token"] ?? data[p.auth.tokenPath?.replace(/^\$\./, "") ?? "access_token"] ?? "");
      if (!token) return { ok: false, message: "❌ Token não encontrado na resposta de auth." };
    } else if (p.auth.type === "api-key") {
      token = p.auth.apiKey;
    }

    // Step 2: chat test
    const vars: Record<string, string> = { prompt: "Oi" };
    if (token) vars["auth.token"] = token;
    for (const [k, v] of Object.entries(p.params ?? {})) vars[`params.${k}`] = v;

    const applyTpl = (s: string) => s.replace(/\{\{([^}]+)\}\}/g, (_, k: string) => vars[k.trim()] ?? `{{${k}}}`);

    const resolvedUrl = applyTpl(p.chat.url);
    const resolvedBody = applyTpl(p.chat.bodyTemplate);
    const resolvedHeaders: Record<string, string> = { "Content-Type": "application/json" };
    for (const [k, v] of Object.entries(p.chat.headers ?? {})) resolvedHeaders[k] = applyTpl(v);
    if (token && p.auth.type === "api-key" && !resolvedHeaders[p.auth.headerName]) {
      resolvedHeaders[p.auth.headerName] = token;
    } else if (token && p.auth.type === "oauth2-client-credentials" && !resolvedHeaders["Authorization"]) {
      resolvedHeaders["Authorization"] = `Bearer ${token}`;
    }

    let parsedBody: unknown;
    try { parsedBody = JSON.parse(resolvedBody); }
    catch { return { ok: false, message: `❌ Body template inválido após substituição:\n${resolvedBody}` }; }

    const chatRes = await fetch(resolvedUrl, {
      method: p.chat.method,
      headers: resolvedHeaders,
      body: JSON.stringify(parsedBody),
    });
    if (!chatRes.ok) {
      const text = await chatRes.text();
      return { ok: false, message: `❌ Chat falhou (${chatRes.status}): ${text}` };
    }
    const chatData = (await chatRes.json()) as unknown;

    // Extract reply using a simple dot-path from responsePath (e.g. $.message → message)
    const pathKey = p.responsePath.replace(/^\$\./, "");
    const reply = (chatData as Record<string, unknown>)[pathKey];
    if (reply === undefined) {
      return { ok: false, message: `❌ JSONPath "${p.responsePath}" não encontrado na resposta.\nResposta recebida: ${JSON.stringify(chatData).slice(0, 300)}` };
    }

    return { ok: true, message: "✅ Conexão bem-sucedida!", reply: String(reply) };
  } catch (err) {
    return { ok: false, message: `❌ ${(err as Error).message}` };
  }
}
