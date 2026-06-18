import * as readline from "node:readline/promises";
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { PasteStore, PasteFilter, PASTE_START, PASTE_END } from "../src/ui/paste.js";

const fmt = (id: number, lines: number) => `[P#${id}+${lines}]`;

describe("PasteStore", () => {
  it("registers text and expands its placeholder back to the full content", () => {
    const store = new PasteStore(fmt);
    const ph = store.add("line1\nline2\nline3");
    expect(ph).toBe("[P#1+3]");
    expect(store.expand(`before ${ph} after`)).toBe("before line1\nline2\nline3 after");
  });

  it("leaves lines without placeholders untouched", () => {
    const store = new PasteStore(fmt);
    expect(store.expand("just typed text")).toBe("just typed text");
  });
});

describe("PasteFilter", () => {
  function filtered(chunks: string[]) {
    const store = new PasteStore(fmt);
    const f = new PasteFilter(store);
    const out = chunks.map((c) => f.push(c)).join("");
    return { out, store };
  }

  it("passes plain typed text straight through", () => {
    expect(filtered(["hello world"]).out).toBe("hello world");
  });

  it("replaces a multi-line paste with a placeholder and stores the full text", () => {
    const { out, store } = filtered([`${PASTE_START}a\nb\nc${PASTE_END}`]);
    expect(out).toBe("[P#1+3]");
    expect(store.expand(out)).toBe("a\nb\nc");
  });

  it("lets a single-line paste through without a placeholder", () => {
    const { out, store } = filtered([`${PASTE_START}short${PASTE_END}`]);
    expect(out).toBe("short");
    expect(store.size).toBe(0);
  });

  it("preserves text around the paste", () => {
    const { out } = filtered([`hi ${PASTE_START}x\ny${PASTE_END} bye`]);
    expect(out).toBe("hi [P#1+2] bye");
  });

  it("handles paste markers split across chunks", () => {
    const { out, store } = filtered(["\x1b[2", "00~a\nb", "\x1b[20", "1~"]);
    expect(out).toBe("[P#1+2]");
    expect(store.expand(out)).toBe("a\nb");
  });
});

describe("paste flow through a terminal readline", () => {
  it("assembles one line from a pasted block and expands it", async () => {
    const store = new PasteStore(fmt);
    const f = new PasteFilter(store);
    const proxy = new PassThrough();
    const rl = readline.createInterface({ input: proxy, output: new PassThrough(), terminal: true });

    const p = rl.question("> ");
    // Simulate: type "run ", paste a 2-line block, then press Enter.
    proxy.write(f.push("run "));
    proxy.write(f.push(`${PASTE_START}foo\nbar${PASTE_END}`));
    proxy.write(f.push("\r"));

    const line = await p;
    rl.close();
    expect(line).toBe("run [P#1+2]");
    expect(store.expand(line)).toBe("run foo\nbar");
  });
});
