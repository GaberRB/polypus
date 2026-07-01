import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { configDir } from "../config/store.js";

/** Files above this size are recorded in the manifest but not captured. */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

export interface CheckpointFile {
  /** Path as the tool addressed it (workspace-relative). */
  path: string;
  /** Hash of the pre-edit content in the object store, or null if the file did
   * not exist before this edit (restoring it means deleting the file). */
  hash: string | null;
  /** True when the file existed but was too large to capture. */
  skipped?: boolean;
}

export interface Checkpoint {
  /** 1-based position in the session's checkpoint list. */
  index: number;
  ts: string;
  tool: string;
  /** Agent step that produced this checkpoint (for display). */
  step: number;
  files: CheckpointFile[];
}

export function checkpointsRoot(): string {
  return join(configDir(), "checkpoints");
}
function sessionDir(sessionId: string): string {
  return join(checkpointsRoot(), sessionId);
}
function objectsDir(sessionId: string): string {
  return join(sessionDir(sessionId), "objects");
}
function manifestPath(sessionId: string, index: number): string {
  return join(sessionDir(sessionId), `${String(index).padStart(6, "0")}.json`);
}

/** List a session's checkpoints, ascending by index. */
export async function listCheckpoints(sessionId: string): Promise<Checkpoint[]> {
  let files: string[];
  try {
    files = (await readdir(sessionDir(sessionId))).filter((f) => /^\d{6}\.json$/.test(f));
  } catch {
    return [];
  }
  const out: Checkpoint[] = [];
  for (const f of files.sort()) {
    try {
      out.push(JSON.parse(await readFile(join(sessionDir(sessionId), f), "utf8")) as Checkpoint);
    } catch {
      /* skip corrupt manifest */
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

/**
 * Capture the pre-edit state of the given files before a write-family tool runs.
 * Content-addressed (deduped by hash). Best-effort: returns undefined and never
 * throws if anything goes wrong, so checkpointing can't disrupt a run.
 */
export async function captureCheckpoint(
  workspace: string,
  sessionId: string,
  tool: string,
  step: number,
  paths: string[],
): Promise<Checkpoint | undefined> {
  try {
    const unique = [...new Set(paths.filter((p) => p && p.length > 0))];
    if (unique.length === 0) return undefined;
    await mkdir(objectsDir(sessionId), { recursive: true });

    const captured: CheckpointFile[] = [];
    for (const path of unique) {
      const abs = resolve(workspace, path);
      let buf: Buffer | undefined;
      try {
        buf = await readFile(abs);
      } catch {
        captured.push({ path, hash: null }); // did not exist → restore = delete
        continue;
      }
      if (buf.byteLength > MAX_FILE_BYTES) {
        captured.push({ path, hash: null, skipped: true });
        continue;
      }
      const hash = createHash("sha1").update(buf).digest("hex");
      const obj = join(objectsDir(sessionId), hash);
      if (!existsSync(obj)) await writeFile(obj, buf);
      captured.push({ path, hash });
    }

    const index = (await listCheckpoints(sessionId)).length + 1;
    const checkpoint: Checkpoint = { index, ts: new Date().toISOString(), tool, step, files: captured };
    await writeFile(manifestPath(sessionId, index), JSON.stringify(checkpoint, null, 2) + "\n", "utf8");
    return checkpoint;
  } catch {
    return undefined;
  }
}

export interface RestoreResult {
  restored: string[];
  /** Files that were captured-as-absent and therefore deleted on restore. */
  deleted: string[];
  /** Files skipped because they were too large to capture. */
  skipped: string[];
}

/**
 * Rewind the workspace to the state before checkpoint `fromIndex`: for every file
 * touched at checkpoints >= fromIndex, restore its earliest captured pre-edit
 * content (or delete it if it didn't exist then). `opts.file` limits the restore
 * to a single path.
 */
export async function restoreToCheckpoint(
  workspace: string,
  sessionId: string,
  fromIndex: number,
  opts: { file?: string } = {},
): Promise<RestoreResult> {
  const all = await listCheckpoints(sessionId);
  const toUndo = all.filter((c) => c.index >= fromIndex);

  // Earliest pre-state per path across the rewound range.
  const earliest = new Map<string, CheckpointFile>();
  for (const cp of toUndo) {
    for (const f of cp.files) {
      if (!earliest.has(f.path)) earliest.set(f.path, f);
    }
  }

  const result: RestoreResult = { restored: [], deleted: [], skipped: [] };
  for (const [path, file] of earliest) {
    if (opts.file && path !== opts.file) continue;
    const abs = resolve(workspace, path);
    if (file.skipped) {
      result.skipped.push(path);
      continue;
    }
    if (file.hash === null) {
      await rm(abs, { force: true });
      result.deleted.push(path);
      continue;
    }
    try {
      const buf = await readFile(join(objectsDir(sessionId), file.hash));
      await mkdir(join(abs, ".."), { recursive: true });
      await writeFile(abs, buf);
      result.restored.push(path);
    } catch {
      /* object missing — skip this file rather than fail the whole restore */
    }
  }
  return result;
}

/**
 * Garbage-collect old checkpoint sessions: drop any whose newest checkpoint is
 * older than `maxAgeDays`. Best-effort; never throws.
 */
export async function pruneCheckpoints(maxAgeDays = 7): Promise<void> {
  try {
    const sessions = await readdir(checkpointsRoot()).catch(() => [] as string[]);
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    for (const sid of sessions) {
      const cps = await listCheckpoints(sid);
      const newest = cps.at(-1);
      if (!newest) continue;
      if (Date.parse(newest.ts) < cutoff) {
        await rm(sessionDir(sid), { recursive: true, force: true });
      }
    }
  } catch {
    /* best-effort GC */
  }
}
