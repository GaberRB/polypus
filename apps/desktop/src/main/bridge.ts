import { execFile, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { dialog, ipcMain, safeStorage } from "electron";
import {
  addRecentProject,
  chatOnce,
  testConnection,
  configDir,
  DEFAULT_BASE_URL,
  listOpenRouterModels,
  listRecentProjects,
  listSessions,
  loadSession,
  deleteSession,
  loadConfig,
  resolveSecret,
  saveConfig,
  setEnvVar,
  SUGGESTED_KEY_ENV,
  upsertAgent,
  McpClient,
  type SessionRecord,
  type ProviderKind,
} from "@gaberrb/polypus/lib";
import {
  IPC,
  type Agent,
  type ChatMessage,
  type ConfigSnapshot,
  type DirEntry,
  type McpServerEntry,
  type McpToolInfo,
  type ModelPrice,
  type OpenRouterModel,
  type RecentProject,
  type Result,
  type SaveAgentInput,
  type SessionSummary,
} from "../shared/ipc";

/** Load ~/.polypus/.env into process.env (for in-process key resolution). */
function loadPolypusEnv(): void {
  try {
    const text = readFileSync(join(configDir(), ".env"), "utf8");
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const k = line.slice(0, eq).trim();
      let v = line.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (k && process.env[k] === undefined) process.env[k] = v;
    }
  } catch {
    /* no .env yet */
  }
}

/** Env var name to store a provider's key under (suggested, else derived). */
function keyEnvName(provider: string, agentName: string): string {
  return (
    SUGGESTED_KEY_ENV[provider as ProviderKind] ??
    `POLYPUS_${agentName.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_KEY`
  );
}

/** Wrap an in-process core call so the renderer always gets a Result (never a throw). */
async function lib<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * How to invoke the Polypus CLI. Prefer the CLI bundled with the installed
 * `@gaberrb/polypus` dependency, run via Electron-as-Node — so neither a global
 * `polypus` nor an external `node` is required. `POLYPUS_CLI` overrides the path.
 */
function cli(): { cmd: string; baseArgs: string[]; env: NodeJS.ProcessEnv } {
  const override = process.env.POLYPUS_CLI;
  if (override) return { cmd: "node", baseArgs: [override], env: process.env };
  try {
    // exports "." → dist/index.js (the CLI). Run it with Electron's own Node.
    const entry = require.resolve("@gaberrb/polypus");
    return {
      cmd: process.execPath,
      baseArgs: [entry],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    };
  } catch {
    return { cmd: "polypus", baseArgs: [], env: process.env };
  }
}

/** Run a headless `--json` CLI command and parse stdout. Never rejects. */
function runCli(args: string[]): Promise<Result<unknown>> {
  return new Promise((resolve) => {
    const { cmd, baseArgs, env } = cli();
    execFile(cmd, [...baseArgs, ...args], { env, maxBuffer: 64 * 1024 * 1024 }, (err, stdout) => {
      if (err && !stdout) {
        resolve({ ok: false, error: err.message });
        return;
      }
      try {
        resolve({ ok: true, data: JSON.parse(stdout) });
      } catch {
        resolve({ ok: false, error: "Resposta não-JSON do polypus." });
      }
    });
  });
}

/**
 * Run a CLI command that emits plain text (not JSON), e.g. `index`/`retrieve`.
 * Returns stdout (or stderr, which is where `index` prints its status). Never rejects.
 */
function runCliText(args: string[], cwd?: string): Promise<Result<string>> {
  return new Promise((resolve) => {
    const { cmd, baseArgs, env } = cli();
    execFile(
      cmd,
      [...baseArgs, ...args],
      { cwd: cwd || process.cwd(), env, maxBuffer: 64 * 1024 * 1024 },
      (err, stdout, stderr) => {
        const out = (stdout?.trim() ? stdout : stderr) || "";
        if (err && !out.trim()) resolve({ ok: false, error: err.message });
        else if (err) resolve({ ok: false, error: out.trim() });
        else resolve({ ok: true, data: out.trim() });
      },
    );
  });
}

// ── safeStorage key vault ──────────────────────────────────────────────────

const KEYS_FILE = join(configDir(), "keys.enc.json");

async function loadEncryptedKeys(): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) return;
  let raw: string;
  try {
    raw = await readFile(KEYS_FILE, "utf8");
  } catch {
    return; // file doesn't exist yet — first run
  }
  try {
    const store = JSON.parse(raw) as Record<string, string>;
    for (const [name, b64] of Object.entries(store)) {
      if (process.env[name] === undefined) {
        process.env[name] = safeStorage.decryptString(Buffer.from(b64, "base64"));
      }
    }
  } catch {
    /* corrupt file — ignore, .env fallback will handle it */
  }
}

async function saveKey(name: string, value: string): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    // Fallback: write plaintext to .env (existing behaviour).
    await setEnvVar(name, value);
    return;
  }
  let store: Record<string, string> = {};
  try {
    store = JSON.parse(await readFile(KEYS_FILE, "utf8")) as Record<string, string>;
  } catch {
    /* new file */
  }
  store[name] = safeStorage.encryptString(value).toString("base64");
  await mkdir(join(configDir()), { recursive: true });
  await writeFile(KEYS_FILE, JSON.stringify(store, null, 2), "utf8");
}

// ── Model price cache (keyed by model id) ─────────────────────────────────

const priceCache = new Map<string, ModelPrice>();

// ── Wire the IPC handlers ──────────────────────────────────────────────────

/** Wire the IPC handlers. Call once after the app is ready. */
export function registerBridge(): void {
  void loadEncryptedKeys(); // decrypt keys from vault before loadPolypusEnv
  loadPolypusEnv(); // so in-process key resolution (model list) sees ~/.polypus/.env

  ipcMain.handle(IPC.estimate, (_e, task: string) => runCli(["estimate", task, "--json"]));
  ipcMain.handle(IPC.review, (_e, pr: string) => runCli(["review", String(pr), "--json"]));
  ipcMain.handle(IPC.run, (_e, task: string, mode: string) => {
    const m = mode === "plan" || mode === "review" || mode === "bypass" ? mode : "review";
    return runCli(["run", task, "--json", "--mode", m]);
  });
  // RAG (#121): build/query the repo index for the given project dir.
  ipcMain.handle(IPC.index, (_e, dir?: string) => runCliText(["index"], dir));
  ipcMain.handle(IPC.retrieve, (_e, query: string, dir?: string) =>
    runCliText(["retrieve", query], dir),
  );

  // Sidebar (#117): recent projects + sessions, in-process via @gaberrb/polypus/lib.
  ipcMain.handle(IPC.recentList, (): Promise<Result<RecentProject[]>> => lib(listRecentProjects));
  ipcMain.handle(IPC.recentAdd, (_e, path: string) => lib(() => addRecentProject(path)));
  ipcMain.handle(IPC.sessionsList, (_e, projectDir?: string): Promise<Result<SessionSummary[]>> =>
    lib(() => listSessions(projectDir)),
  );

  // Settings / model picker (#112): config + agents + OpenRouter models, in-process.
  ipcMain.handle(IPC.configGet, (): Promise<Result<ConfigSnapshot>> =>
    lib(async () => {
      const cfg = await loadConfig();
      const agents: Agent[] = cfg.agents.map((a) => ({
        name: a.name,
        provider: a.provider,
        model: a.model,
        baseUrl: a.baseUrl,
        toolMode: a.toolMode,
        hasKey: Boolean(a.apiKey),
      }));
      return { agents, defaultAgent: cfg.defaultAgent };
    }),
  );

  ipcMain.handle(IPC.configSaveAgent, (_e, input: SaveAgentInput): Promise<Result<void>> =>
    lib(async () => {
      const cfg = await loadConfig();
      let apiKeyRef: string | undefined;
      if (input.apiKey && input.apiKey.trim()) {
        const envName = keyEnvName(input.provider, input.name);
        await saveKey(envName, input.apiKey.trim());
        process.env[envName] = input.apiKey.trim(); // available immediately this session
        apiKeyRef = `\${${envName}}`;
      } else {
        // Editing without re-entering the key: keep the existing reference.
        apiKeyRef = cfg.agents.find((x) => x.name === input.name)?.apiKey;
      }
      upsertAgent(cfg, {
        name: input.name,
        provider: input.provider as ProviderKind,
        model: input.model,
        apiKey: apiKeyRef,
        baseUrl: input.baseUrl ?? DEFAULT_BASE_URL[input.provider as ProviderKind],
        setDefault: input.setDefault,
      });
      await saveConfig(cfg);
    }),
  );

  ipcMain.handle(IPC.configSetDefault, (_e, name: string): Promise<Result<void>> =>
    lib(async () => {
      const cfg = await loadConfig();
      cfg.defaultAgent = name;
      await saveConfig(cfg);
    }),
  );

  ipcMain.handle(IPC.modelsList, (): Promise<Result<OpenRouterModel[]>> =>
    lib(async () => {
      let key = process.env.OPENROUTER_API_KEY;
      if (!key) {
        const cfg = await loadConfig();
        const a = cfg.agents.find((x) => x.provider === "openrouter" && x.apiKey);
        if (a) {
          try {
            key = resolveSecret(a.apiKey);
          } catch {
            /* env ref not set */
          }
        }
      }
      return listOpenRouterModels(key);
    }),
  );

  // Chat tab (#112): plain conversation, no tools, via the default agent.
  ipcMain.handle(IPC.chatSend, (_e, messages: ChatMessage[]): Promise<Result<string>> =>
    lib(async () => {
      const cfg = await loadConfig();
      const agent =
        cfg.agents.find((a) => a.name === cfg.defaultAgent) ?? cfg.agents[0];
      if (!agent) throw new Error("Nenhum agente configurado. Vá em Personalizar.");
      return chatOnce(agent, messages);
    }),
  );

  // Test a saved agent's connection (credentials/model reachable).
  ipcMain.handle(IPC.configTestAgent, (_e, name: string): Promise<Result<{ ok: boolean; message: string }>> =>
    lib(async () => {
      const cfg = await loadConfig();
      const agent = cfg.agents.find((a) => a.name === name);
      if (!agent) throw new Error("Agente não encontrado.");
      return testConnection(agent);
    }),
  );

  // Native folder picker → returns the chosen path and adds it to recents.
  ipcMain.handle(IPC.dialogFolder, (): Promise<Result<string | undefined>> =>
    lib(async () => {
      const res = await dialog.showOpenDialog({ properties: ["openDirectory"] });
      const dir = res.canceled ? undefined : res.filePaths[0];
      if (dir) await addRecentProject(dir);
      return dir;
    }),
  );

  // Model price lookup (cached) — used by the renderer for cost estimation.
  ipcMain.handle(IPC.modelPrice, (): Promise<Result<ModelPrice | null>> =>
    lib(async () => {
      const cfg = await loadConfig();
      const agent = cfg.agents.find((a) => a.name === cfg.defaultAgent) ?? cfg.agents[0];
      if (!agent) return null;
      const modelId = agent.model;
      if (priceCache.has(modelId)) return priceCache.get(modelId)!;
      if (agent.provider !== "openrouter") return null;
      let key: string | undefined;
      try { key = resolveSecret(agent.apiKey); } catch { return null; }
      const models = await listOpenRouterModels(key);
      const m = models.find((x) => x.id === modelId);
      if (!m) return null;
      const price: ModelPrice = { promptPrice: m.promptPrice, completionPrice: m.completionPrice };
      priceCache.set(modelId, price);
      return price;
    }),
  );

  // MCP: list servers from .poly/mcp.json (returns [] if file absent).
  ipcMain.handle(IPC.mcpList, (_e, dir: string): Promise<Result<McpServerEntry[]>> =>
    lib(async () => {
      let text: string;
      try {
        text = await readFile(join(dir, ".poly", "mcp.json"), "utf8");
      } catch {
        return [];
      }
      const parsed = JSON.parse(text) as {
        mcpServers?: Record<string, { command: string; args?: string[]; env?: Record<string, string> }>;
      };
      return Object.entries(parsed.mcpServers ?? {}).map(([name, cfg]) => ({
        name,
        command: cfg.command,
        args: cfg.args ?? [],
        env: cfg.env ?? {},
      }));
    }),
  );

  // MCP: persist the server list to .poly/mcp.json.
  ipcMain.handle(IPC.mcpSave, (_e, dir: string, servers: McpServerEntry[]): Promise<Result<void>> =>
    lib(async () => {
      const mcpServers: Record<string, { command: string; args: string[]; env: Record<string, string> }> = {};
      for (const s of servers) {
        mcpServers[s.name] = { command: s.command, args: s.args, env: s.env };
      }
      const polyDir = join(dir, ".poly");
      await mkdir(polyDir, { recursive: true });
      await writeFile(join(polyDir, "mcp.json"), JSON.stringify({ mcpServers }, null, 2), "utf8");
    }),
  );

  // MCP: spawn one server, list its tools, then shut it down.
  ipcMain.handle(IPC.mcpTestServer, (_e, entry: McpServerEntry): Promise<Result<McpToolInfo[]>> =>
    lib(async () => {
      const client = new McpClient(entry.command, entry.args, entry.env);
      try {
        await client.initialize();
        const tools = await client.listTools();
        return tools.map((t) => ({ server: entry.name, name: t.name, description: t.description }));
      } finally {
        await client.close().catch(() => {});
      }
    }),
  );

  // Sessions: delete and load.
  ipcMain.handle(IPC.sessionDelete, (_e, id: string): Promise<Result<void>> =>
    lib(() => deleteSession(id)),
  );

  ipcMain.handle(IPC.sessionLoad, (_e, id: string): Promise<Result<SessionRecord | undefined>> =>
    lib(() => loadSession(id)),
  );

  // Filesystem: list a directory and read a file (for the file tree + viewer).
  ipcMain.handle(IPC.dirList, (_e, absPath: string): Promise<Result<DirEntry[]>> =>
    lib(async () => {
      const names = await readdir(absPath);
      const entries: DirEntry[] = [];
      for (const name of names) {
        if (name.startsWith(".") || name === "node_modules") continue;
        try {
          const s = await stat(join(absPath, name));
          entries.push({ name, type: s.isDirectory() ? "dir" : "file", path: join(absPath, name) });
        } catch {
          /* skip unreadable entries */
        }
      }
      return entries.sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    }),
  );

  ipcMain.handle(IPC.fileRead, (_e, absPath: string): Promise<Result<string>> =>
    lib(async () => {
      const MAX = 512 * 1024; // 512 KB hard cap
      const buf = await readFile(absPath);
      if (buf.length > MAX) return buf.slice(0, MAX).toString("utf8") + "\n…[truncated]";
      return buf.toString("utf8");
    }),
  );

  // Streaming run (#115): spawn `run --json --stream` and forward each NDJSON
  // line to the renderer as it arrives, plus terminal end/error events.
  // Track active child process per webContents so runStop can kill it.
  const activeRun = new Map<number, ReturnType<typeof spawn>>();

  ipcMain.on(IPC.runStart, (e, payload: { task: string; mode?: string; dir?: string; resumeSessionId?: string }) => {
    const { cmd, baseArgs, env } = cli();
    const m =
      payload.mode === "plan" || payload.mode === "review" || payload.mode === "bypass"
        ? payload.mode
        : "review";
    const send = (ev: unknown): void => {
      if (!e.sender.isDestroyed()) e.sender.send(IPC.runEvent, ev);
    };

    const runArgs = [...baseArgs, "run", payload.task, "--json", "--stream", "--mode", m];
    if (payload.resumeSessionId) runArgs.push("--resume", payload.resumeSessionId);

    const child = spawn(cmd, runArgs, {
      cwd: payload.dir || process.cwd(),
      env,
    });

    const wcId = e.sender.id;
    activeRun.set(wcId, child);

    let buf = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => {
      buf += d.toString();
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        try {
          send(JSON.parse(line));
        } catch {
          /* ignore non-JSON noise */
        }
      }
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("error", (err) => send({ type: "error", message: err.message }));
    child.on("close", (code) => {
      activeRun.delete(wcId);
      if (code !== 0 && !child.killed && stderr.trim()) send({ type: "error", message: stderr.trim() });
      send({ type: "end", code });
    });
  });

  ipcMain.on(IPC.runStop, (e) => {
    const child = activeRun.get(e.sender.id);
    if (child) {
      child.kill("SIGTERM");
      activeRun.delete(e.sender.id);
    }
  });
}
