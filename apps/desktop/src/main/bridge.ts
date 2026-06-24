import { execFile, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dialog, ipcMain } from "electron";
import {
  addRecentProject,
  chatOnce,
  testConnection,
  configDir,
  DEFAULT_BASE_URL,
  listOpenRouterModels,
  listRecentProjects,
  listSessions,
  loadConfig,
  resolveSecret,
  saveConfig,
  setEnvVar,
  SUGGESTED_KEY_ENV,
  upsertAgent,
  type ProviderKind,
} from "@gaberrb/polypus/lib";
import {
  IPC,
  type Agent,
  type ChatMessage,
  type ConfigSnapshot,
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

/** Wire the IPC handlers. Call once after the app is ready. */
export function registerBridge(): void {
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
  ipcMain.handle(IPC.sessionsList, (): Promise<Result<SessionSummary[]>> => lib(listSessions));

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
        await setEnvVar(envName, input.apiKey.trim());
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

  // Streaming run (#115): spawn `run --json --stream` and forward each NDJSON
  // line to the renderer as it arrives, plus terminal end/error events.
  ipcMain.on(IPC.runStart, (e, payload: { task: string; mode?: string; dir?: string }) => {
    const { cmd, baseArgs, env } = cli();
    const m =
      payload.mode === "plan" || payload.mode === "review" || payload.mode === "bypass"
        ? payload.mode
        : "review";
    const send = (ev: unknown): void => {
      if (!e.sender.isDestroyed()) e.sender.send(IPC.runEvent, ev);
    };

    const child = spawn(cmd, [...baseArgs, "run", payload.task, "--json", "--stream", "--mode", m], {
      cwd: payload.dir || process.cwd(),
      env,
    });

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
      if (code !== 0 && stderr.trim()) send({ type: "error", message: stderr.trim() });
      send({ type: "end", code });
    });
  });
}
