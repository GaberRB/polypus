import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { chunkFile } from "../src/core/retrieval/chunker.js";
import { cosineTopK, formatChunks } from "../src/core/retrieval/retriever.js";
import { buildIndex } from "../src/core/retrieval/indexer.js";
import { contentHash, repoHash, type StoredChunk } from "../src/core/retrieval/store.js";
import type { Embedder } from "../src/core/retrieval/embedder.js";

const dirs: string[] = [];
function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), "polypus-rag-"));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

/** Deterministic embedder: vector = [len, #a, #b], counts every embed() call. */
class FakeEmbedder implements Embedder {
  calls = 0;
  embedded = 0;
  constructor(readonly model = "fake-embed") {}
  async embed(texts: string[]): Promise<number[][]> {
    this.calls++;
    this.embedded += texts.length;
    return texts.map((t) => [t.length, count(t, "a"), count(t, "b")]);
  }
}
const count = (s: string, ch: string) => s.split(ch).length - 1;

const chunk = (file: string, vector: number[]): StoredChunk => ({
  file,
  startLine: 1,
  endLine: 1,
  text: file,
  vector,
});

describe("chunkFile", () => {
  it("windows lines with overlap and 1-based ranges", () => {
    const text = Array.from({ length: 10 }, (_, i) => `line${i + 1}`).join("\n");
    const chunks = chunkFile("a.ts", text, { windowLines: 4, overlapLines: 1 });
    expect(chunks[0]).toMatchObject({ file: "a.ts", startLine: 1, endLine: 4 });
    // step = window - overlap = 3 → next starts at line 4.
    expect(chunks[1]!.startLine).toBe(4);
    expect(chunks.at(-1)!.endLine).toBe(10);
  });

  it("drops blank-only windows and handles a trailing newline", () => {
    expect(chunkFile("e.ts", "\n\n\n")).toEqual([]);
    const one = chunkFile("f.ts", "only line\n");
    expect(one).toHaveLength(1);
    expect(one[0]).toMatchObject({ startLine: 1, endLine: 1, text: "only line" });
  });
});

describe("cosineTopK", () => {
  it("ranks by cosine similarity and respects k", () => {
    const chunks = [
      chunk("far.ts", [0, 1, 0]),
      chunk("near.ts", [1, 0, 0]),
      chunk("mid.ts", [1, 1, 0]),
    ];
    const ranked = cosineTopK([1, 0, 0], chunks, 2);
    expect(ranked.map((r) => r.chunk.file)).toEqual(["near.ts", "mid.ts"]);
    expect(ranked[0]!.score).toBeCloseTo(1, 5);
  });

  it("returns nothing for a zero query vector", () => {
    expect(cosineTopK([0, 0, 0], [chunk("a.ts", [1, 1, 1])], 5)).toEqual([]);
  });
});

describe("formatChunks", () => {
  it("renders file:line headers and stops at maxChars", () => {
    const results = [
      { chunk: { file: "a.ts", startLine: 1, endLine: 2, text: "AAAA", vector: [] }, score: 0.9 },
      { chunk: { file: "b.ts", startLine: 3, endLine: 4, text: "BBBB", vector: [] }, score: 0.5 },
    ];
    const out = formatChunks(results);
    expect(out).toContain("## a.ts:1-2 (0.900)");
    expect(out).toContain("## b.ts:3-4 (0.500)");
    // A tiny cap keeps only the first block.
    expect(formatChunks(results, 10)).toContain("a.ts");
    expect(formatChunks(results, 10)).not.toContain("b.ts");
  });
});

describe("store helpers", () => {
  it("repoHash is stable per path and contentHash tracks content", () => {
    expect(repoHash("/repo/x")).toBe(repoHash("/repo/x"));
    expect(repoHash("/repo/x")).not.toBe(repoHash("/repo/y"));
    expect(contentHash("a")).toBe(contentHash("a"));
    expect(contentHash("a")).not.toBe(contentHash("b"));
  });
});

describe("buildIndex (incremental)", () => {
  it("embeds new files, reuses unchanged ones, and re-embeds on change", async () => {
    const ws = tempDir();
    writeFileSync(join(ws, "a.ts"), "alpha\n");
    writeFileSync(join(ws, "b.ts"), "beta\n");

    const emb = new FakeEmbedder();
    const first = await buildIndex(ws, emb, null);
    expect(first.stats.filesEmbedded).toBe(2);
    expect(first.data.chunks).toHaveLength(2);
    const embeddedAfterFirst = emb.embedded;

    // No changes → everything reused, nothing re-embedded.
    const second = await buildIndex(ws, emb, first.data);
    expect(second.stats.filesReused).toBe(2);
    expect(second.stats.filesEmbedded).toBe(0);
    expect(emb.embedded).toBe(embeddedAfterFirst);

    // Change one file → only it is re-embedded.
    writeFileSync(join(ws, "a.ts"), "alpha changed\n");
    const third = await buildIndex(ws, emb, second.data);
    expect(third.stats.filesEmbedded).toBe(1);
    expect(third.stats.filesReused).toBe(1);
  });

  it("re-embeds everything when the model changes", async () => {
    const ws = tempDir();
    writeFileSync(join(ws, "a.ts"), "alpha\n");
    const first = await buildIndex(ws, new FakeEmbedder("model-1"), null);
    const second = await buildIndex(ws, new FakeEmbedder("model-2"), first.data);
    expect(second.stats.filesReused).toBe(0);
    expect(second.stats.filesEmbedded).toBe(1);
  });
});
