import { execFile } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { toPosix } from "../permissions/allowlist.js";
import { chunkFile } from "./chunker.js";
import type { Embedder } from "./embedder.js";
import { contentHash, INDEX_VERSION, type IndexData, type StoredChunk } from "./store.js";

const exec = promisify(execFile);

const MAX_FILE_BYTES = 1_000_000;
const EMBED_BATCH = 64;
const NUL = String.fromCharCode(0);
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".next", "coverage", ".turbo", ".polypus"]);
/** Extensions that are never useful as retrieval context (binary or generated). */
const SKIP_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg", ".pdf", ".zip", ".gz",
  ".woff", ".woff2", ".ttf", ".eot", ".mp4", ".mov", ".mp3", ".wasm", ".lock",
]);

function skipByExt(rel: string): boolean {
  const dot = rel.lastIndexOf(".");
  if (dot === -1) return false;
  return SKIP_EXT.has(rel.slice(dot).toLowerCase()) || rel.endsWith("package-lock.json");
}

/**
 * List candidate source files (workspace-relative POSIX). Prefers `git ls-files`
 * (honours .gitignore, excludes node_modules); falls back to a filtered walk for
 * non-git checkouts.
 */
export async function collectFiles(workspace: string): Promise<string[]> {
  let rels: string[] = [];
  try {
    const { stdout } = await exec("git", ["-C", workspace, "ls-files"], { maxBuffer: 64 * 1024 * 1024 });
    rels = stdout.split("\n").map((l) => l.trim()).filter(Boolean);
  } catch {
    // Not a git repo — fall through to the filesystem walk below.
  }
  // Empty can mean "no tracked files" (e.g. the workspace is inside an unrelated
  // repo, or nothing committed yet) — walk the tree instead of indexing nothing.
  if (rels.length === 0) rels = await walk(workspace, workspace);
  return rels.filter((r) => !skipByExt(r)).sort();
}

async function walk(root: string, dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...(await walk(root, abs)));
    } else if (entry.isFile()) {
      out.push(toPosix(abs.slice(root.length + 1)));
    }
  }
  return out;
}

/** Read a text file, returning null when missing, binary, or too large to index. */
async function readTextFile(abs: string): Promise<string | null> {
  try {
    const info = await stat(abs);
    if (!info.isFile() || info.size > MAX_FILE_BYTES) return null;
    const text = await readFile(abs, "utf8");
    return text.includes(NUL) ? null : text;
  } catch {
    return null;
  }
}

export interface BuildProgress {
  /** Called as each file is processed, for CLI progress output. */
  onFile?: (rel: string, status: "embedded" | "reused" | "skipped") => void;
}

export interface BuildStats {
  filesEmbedded: number;
  filesReused: number;
  filesSkipped: number;
  chunks: number;
}

/**
 * Build (or incrementally update) the index for a workspace. Files whose content
 * hash is unchanged since `prev` reuse their existing vectors; only new/changed
 * files are re-embedded. Returns the fresh IndexData plus stats.
 */
export async function buildIndex(
  workspace: string,
  embedder: Embedder,
  prev: IndexData | null,
  progress: BuildProgress = {},
): Promise<{ data: IndexData; stats: BuildStats }> {
  // A model change (or rebuild) invalidates every cached vector.
  const reusable = prev && prev.model === embedder.model ? prev : null;
  const prevChunksByFile = new Map<string, StoredChunk[]>();
  if (reusable) {
    for (const c of reusable.chunks) {
      (prevChunksByFile.get(c.file) ?? prevChunksByFile.set(c.file, []).get(c.file)!).push(c);
    }
  }

  const files = await collectFiles(workspace);
  const newFiles: Record<string, { hash: string }> = {};
  const keptChunks: StoredChunk[] = [];
  const toEmbed: { chunk: { file: string; startLine: number; endLine: number; text: string } }[] = [];
  const stats: BuildStats = { filesEmbedded: 0, filesReused: 0, filesSkipped: 0, chunks: 0 };

  for (const rel of files) {
    const text = await readTextFile(resolve(workspace, rel));
    if (text === null) {
      stats.filesSkipped++;
      progress.onFile?.(rel, "skipped");
      continue;
    }
    const hash = contentHash(text);
    newFiles[rel] = { hash };

    const cached = reusable?.files[rel]?.hash === hash ? prevChunksByFile.get(rel) : undefined;
    if (cached) {
      keptChunks.push(...cached);
      stats.filesReused++;
      progress.onFile?.(rel, "reused");
      continue;
    }
    for (const c of chunkFile(rel, text)) toEmbed.push({ chunk: c });
    stats.filesEmbedded++;
    progress.onFile?.(rel, "embedded");
  }

  // Embed new chunks in batches to bound request size.
  const freshChunks: StoredChunk[] = [];
  for (let i = 0; i < toEmbed.length; i += EMBED_BATCH) {
    const batch = toEmbed.slice(i, i + EMBED_BATCH);
    const vectors = await embedder.embed(batch.map((b) => b.chunk.text));
    batch.forEach((b, j) => freshChunks.push({ ...b.chunk, vector: vectors[j]! }));
  }

  const chunks = [...keptChunks, ...freshChunks];
  stats.chunks = chunks.length;
  const dim = chunks[0]?.vector.length ?? reusable?.dim ?? 0;

  const data: IndexData = {
    version: INDEX_VERSION,
    model: embedder.model,
    dim,
    files: newFiles,
    chunks,
  };
  return { data, stats };
}
