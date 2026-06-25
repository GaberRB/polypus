import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PermissionMode } from "../config/schema.js";
import { configDir } from "../config/store.js";
import { redactSecrets } from "../permissions/policy.js";
import type { Message } from "../providers/types.js";

export interface SessionRecord {
  id: string;
  /** ISO timestamp of the last update. */
  updatedAt: string;
  /** Short title (the first user task), for listings. */
  title: string;
  agentName: string;
  mode: PermissionMode;
  messages: Message[];
  /** Absolute path of the project folder this session belongs to. */
  projectDir?: string;
}

export interface SessionSummary {
  id: string;
  updatedAt: string;
  title: string;
  agentName: string;
  mode: PermissionMode;
  messageCount: number;
  projectDir?: string;
}

export function sessionsDir(): string {
  return join(configDir(), "sessions");
}

/** Create a sortable, filesystem-safe session id from the current time. */
export function newSessionId(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const rand = Math.random().toString(36).slice(2, 6);
  return `${stamp}-${rand}`;
}

function sessionPath(id: string): string {
  return join(sessionsDir(), `${id}.json`);
}

/** Persist a session, redacting obvious secrets from message contents. */
export async function saveSession(record: SessionRecord): Promise<void> {
  await mkdir(sessionsDir(), { recursive: true });
  const safe: SessionRecord = {
    ...record,
    messages: record.messages.map((m) => ({ ...m, content: redactSecrets(m.content) })),
  };
  await writeFile(sessionPath(record.id), JSON.stringify(safe, null, 2) + "\n", "utf8");
}

/** Load a session by id, or undefined if it does not exist / is unreadable. */
export async function loadSession(id: string): Promise<SessionRecord | undefined> {
  try {
    return JSON.parse(await readFile(sessionPath(id), "utf8")) as SessionRecord;
  } catch {
    return undefined;
  }
}

/** List saved sessions, most recently updated first. Optionally filter by project dir. */
export async function listSessions(projectDir?: string): Promise<SessionSummary[]> {
  let files: string[];
  try {
    files = (await readdir(sessionsDir())).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const summaries: SessionSummary[] = [];
  for (const f of files) {
    try {
      const r = JSON.parse(await readFile(join(sessionsDir(), f), "utf8")) as SessionRecord;
      // When a projectDir filter is given, skip sessions from other projects.
      // Sessions without projectDir (legacy) are also excluded to avoid cross-project contamination.
      if (projectDir !== undefined && r.projectDir !== projectDir) continue;
      summaries.push({
        id: r.id,
        updatedAt: r.updatedAt,
        title: r.title,
        agentName: r.agentName,
        mode: r.mode,
        messageCount: r.messages?.length ?? 0,
        projectDir: r.projectDir,
      });
    } catch {
      /* skip corrupt session files */
    }
  }
  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Delete a session file by id. No-op if the file does not exist. */
export async function deleteSession(id: string): Promise<void> {
  try {
    const { unlink } = await import("node:fs/promises");
    await unlink(sessionPath(id));
  } catch {
    /* already gone */
  }
}

/** The most recently updated session, if any (used by `run --continue`). */
export async function latestSession(): Promise<SessionRecord | undefined> {
  const [latest] = await listSessions();
  return latest ? loadSession(latest.id) : undefined;
}

/** Derive a short title from the first user message of a history. */
export function deriveTitle(messages: Message[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  const text = (firstUser?.content ?? "").replace(/\s+/g, " ").trim();
  return text.length > 60 ? text.slice(0, 60) + "…" : text || "(untitled)";
}
