import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { configDir } from "../config/store.js";

/** Bump when the on-disk shape changes so stale indexes are rebuilt, not misread. */
export const INDEX_VERSION = 1;

/** One embedded slice of a file. */
export interface StoredChunk {
  file: string;
  startLine: number;
  endLine: number;
  text: string;
  vector: number[];
}

export interface IndexData {
  version: number;
  /** Embedding model the vectors were produced with (a change forces a rebuild). */
  model: string;
  /** Vector dimensionality (sanity check at query time). */
  dim: number;
  /** Per-file content hash, so re-indexing only re-embeds what changed. */
  files: Record<string, { hash: string }>;
  chunks: StoredChunk[];
}

/** Short, stable id for a workspace path — keeps each repo's index separate. */
export function repoHash(workspace: string): string {
  return createHash("sha256").update(resolve(workspace)).digest("hex").slice(0, 16);
}

/** Directory holding this repo's index, under ~/.polypus/index/<repo-hash>/. */
export function indexDir(workspace: string): string {
  return join(configDir(), "index", repoHash(workspace));
}

export function indexPath(workspace: string): string {
  return join(indexDir(workspace), "index.json");
}

/** sha256 of file content, used for incremental invalidation. */
export function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Load a repo's index, or null if none exists / it is unreadable. */
export async function loadIndex(workspace: string): Promise<IndexData | null> {
  try {
    const raw = await readFile(indexPath(workspace), "utf8");
    const data = JSON.parse(raw) as IndexData;
    if (data.version !== INDEX_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

export async function saveIndex(workspace: string, data: IndexData): Promise<void> {
  await mkdir(indexDir(workspace), { recursive: true });
  await writeFile(indexPath(workspace), JSON.stringify(data), "utf8");
}
