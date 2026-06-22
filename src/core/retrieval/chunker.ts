/** A contiguous slice of a file, the unit that gets embedded and retrieved. */
export interface Chunk {
  /** Workspace-relative POSIX path. */
  file: string;
  /** 1-based inclusive line range. */
  startLine: number;
  endLine: number;
  text: string;
}

export interface ChunkOptions {
  /** Lines per chunk window. */
  windowLines?: number;
  /** Lines shared between consecutive chunks (context continuity). */
  overlapLines?: number;
}

const DEFAULT_WINDOW = 60;
const DEFAULT_OVERLAP = 15;

/**
 * Split a file into overlapping line windows. Pure: same input → same chunks,
 * so it can be unit-tested without touching disk. Blank-only windows are dropped.
 */
export function chunkFile(file: string, text: string, opts: ChunkOptions = {}): Chunk[] {
  const window = Math.max(1, opts.windowLines ?? DEFAULT_WINDOW);
  const overlap = Math.min(Math.max(0, opts.overlapLines ?? DEFAULT_OVERLAP), window - 1);
  const step = window - overlap;

  const lines = text.split("\n");
  // Drop a trailing empty element produced by a final newline.
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  if (lines.length === 0) return [];

  const chunks: Chunk[] = [];
  for (let start = 0; start < lines.length; start += step) {
    const end = Math.min(start + window, lines.length);
    const slice = lines.slice(start, end);
    if (slice.some((l) => l.trim() !== "")) {
      chunks.push({ file, startLine: start + 1, endLine: end, text: slice.join("\n") });
    }
    if (end >= lines.length) break;
  }
  return chunks;
}
