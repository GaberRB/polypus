import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyHunks, computeHunks } from "../src/core/permissions/diff.js";
import { PermissionEngine } from "../src/core/permissions/modes.js";

describe("computeHunks / applyHunks", () => {
  it("produces a hunk for a single changed line", () => {
    const oldText = "a\nb\nc\n";
    const newText = "a\nB\nc\n";
    const hunks = computeHunks(oldText, newText);
    expect(hunks).toHaveLength(1);
    const types = hunks[0]!.lines.map((l) => l.type).join("");
    expect(types).toContain("-");
    expect(types).toContain("+");
  });

  it("applying all hunks reproduces the new text", () => {
    const oldText = "one\ntwo\nthree\nfour\nfive\n";
    const newText = "one\nTWO\nthree\nfour\nFIVE\n";
    const hunks = computeHunks(oldText, newText);
    const all = new Set(hunks.map((_, i) => i));
    expect(applyHunks(oldText, hunks, all)).toBe(newText);
  });

  it("applying no hunks reproduces the old text", () => {
    const oldText = "one\ntwo\nthree\nfour\nfive\n";
    const newText = "one\nTWO\nthree\nfour\nFIVE\n";
    const hunks = computeHunks(oldText, newText);
    expect(applyHunks(oldText, hunks, new Set())).toBe(oldText);
  });

  it("applies only the approved hunk (partial approval)", () => {
    // Two well-separated changes → two hunks.
    const oldText = Array.from({ length: 20 }, (_, i) => `line${i}`).join("\n");
    const lines = oldText.split("\n");
    lines[1] = "CHANGED1";
    lines[18] = "CHANGED18";
    const newText = lines.join("\n");
    const hunks = computeHunks(oldText, newText);
    expect(hunks.length).toBe(2);

    const onlyFirst = applyHunks(oldText, hunks, new Set([0]));
    expect(onlyFirst).toContain("CHANGED1");
    expect(onlyFirst).not.toContain("CHANGED18");
    expect(onlyFirst.split("\n")[18]).toBe("line18");
  });

  it("handles creating a brand-new file (empty old)", () => {
    const hunks = computeHunks("", "hello\nworld\n");
    expect(applyHunks("", hunks, new Set(hunks.map((_, i) => i)))).toBe("hello\nworld\n");
    expect(applyHunks("", hunks, new Set())).toBe("");
  });
});

describe("PermissionEngine review-mode hunk approval", () => {
  const dirs: string[] = [];
  function workspace(): string {
    const d = mkdtempSync(join(tmpdir(), "polypus-diff-"));
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

  it("returns reconstructed content when only some hunks are approved", async () => {
    const ws = workspace();
    const oldText = Array.from({ length: 20 }, (_, i) => `line${i}`).join("\n");
    writeFileSync(join(ws, "f.txt"), oldText);
    const lines = oldText.split("\n");
    lines[1] = "CHANGED1";
    lines[18] = "CHANGED18";
    const newText = lines.join("\n");

    const engine = new PermissionEngine({
      mode: "review",
      policy: { workspace: ws, allow: ["**/*"], deny: [] },
      allowedCommands: [],
      confirm: async () => [0], // approve only the first hunk
    });

    const decision = await engine.authorizeWrite("f.txt", "preview", newText);
    expect(decision.allowed).toBe(true);
    expect(decision.content).toBeDefined();
    expect(decision.content).toContain("CHANGED1");
    expect(decision.content).not.toContain("CHANGED18");
  });

  it("approving all (true) writes the full new content without a content override", async () => {
    const ws = workspace();
    writeFileSync(join(ws, "f.txt"), "a\nb\n");
    const engine = new PermissionEngine({
      mode: "review",
      policy: { workspace: ws, allow: ["**/*"], deny: [] },
      allowedCommands: [],
      confirm: async () => true,
    });
    const decision = await engine.authorizeWrite("f.txt", "preview", "a\nB\n");
    expect(decision.allowed).toBe(true);
    expect(decision.content).toBeUndefined();
  });

  it("rejecting (false) denies the write", async () => {
    const ws = workspace();
    writeFileSync(join(ws, "f.txt"), "a\nb\n");
    const engine = new PermissionEngine({
      mode: "review",
      policy: { workspace: ws, allow: ["**/*"], deny: [] },
      allowedCommands: [],
      confirm: async () => false,
    });
    const decision = await engine.authorizeWrite("f.txt", "preview", "a\nB\n");
    expect(decision.allowed).toBe(false);
  });
});
