import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyPatchTool, applyUnifiedDiff } from "../src/core/tools/apply-patch.js";
import { PermissionEngine } from "../src/core/permissions/modes.js";
import type { PermissionMode } from "../src/core/config/schema.js";

const dirs: string[] = [];
function workspace(): string {
  const d = mkdtempSync(join(tmpdir(), "polypus-patch-"));
  dirs.push(d);
  return d;
}
function ctx(ws: string, mode: PermissionMode = "bypass") {
  return {
    workspace: ws,
    permissions: new PermissionEngine({ mode, policy: { workspace: ws, allow: ["**/*"], deny: [] }, allowedCommands: [] }),
  };
}

const FILE = "a\nb\nc\nd\ne\nf\ng\n";

afterEach(() => {
  for (const d of dirs.splice(0)) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

describe("applyUnifiedDiff (pure)", () => {
  it("applies a single replace hunk and preserves the trailing newline", () => {
    const patch = "@@ -1,3 +1,3 @@\n a\n-b\n+B\n c\n";
    const res = applyUnifiedDiff(FILE, patch);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.result).toBe("a\nB\nc\nd\ne\nf\ng\n");
  });

  it("applies multiple non-overlapping hunks", () => {
    const patch = ["@@ -1,3 +1,3 @@", " a", "-b", "+B", " c", "@@ -5,3 +5,3 @@", " e", "-f", "+F", " g"].join("\n");
    const res = applyUnifiedDiff(FILE, patch);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.result).toBe("a\nB\nc\nd\ne\nF\ng\n");
      expect(res.hunks).toBe(2);
    }
  });

  it("inserts a line using surrounding context", () => {
    const patch = "@@ -2,3 +2,4 @@\n b\n c\n+c2\n d\n";
    const res = applyUnifiedDiff(FILE, patch);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.result).toBe("a\nb\nc\nc2\nd\ne\nf\ng\n");
  });

  it("matches via context even when the declared line number is off", () => {
    // oldStart says 1 but the real context is later; the applier scans forward.
    const patch = "@@ -1,3 +1,3 @@\n e\n-f\n+F\n g\n";
    const res = applyUnifiedDiff(FILE, patch);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.result).toBe("a\nb\nc\nd\ne\nF\ng\n");
  });

  it("fails (without corrupting) when a hunk does not match", () => {
    const patch = "@@ -1,3 +1,3 @@\n a\n-NOPE\n+X\n c\n";
    const res = applyUnifiedDiff(FILE, patch);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/did not match/);
  });

  it("rejects a patch with no hunks", () => {
    const res = applyUnifiedDiff(FILE, "not a diff");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/No hunks/);
  });

  it("rejects a malformed hunk header", () => {
    const res = applyUnifiedDiff(FILE, "@@ bad header @@\n a\n");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Malformed hunk header/);
  });
});

describe("apply_patch tool", () => {
  it("applies a patch to a file on disk", async () => {
    const ws = workspace();
    writeFileSync(join(ws, "f.txt"), FILE);
    const patch = "@@ -1,3 +1,3 @@\n a\n-b\n+B\n c\n";
    const res = await applyPatchTool.run({ path: "f.txt", patch }, ctx(ws));
    expect(res.ok).toBe(true);
    expect(readFileSync(join(ws, "f.txt"), "utf8")).toBe("a\nB\nc\nd\ne\nf\ng\n");
  });

  it("writes nothing and reports the error when a hunk does not match", async () => {
    const ws = workspace();
    writeFileSync(join(ws, "f.txt"), FILE);
    const res = await applyPatchTool.run({ path: "f.txt", patch: "@@ -1,1 +1,1 @@\n-NOPE\n+X\n" }, ctx(ws));
    expect(res.ok).toBe(false);
    expect(readFileSync(join(ws, "f.txt"), "utf8")).toBe(FILE); // untouched
  });

  it("is blocked in plan mode", async () => {
    const ws = workspace();
    writeFileSync(join(ws, "f.txt"), FILE);
    const res = await applyPatchTool.run({ path: "f.txt", patch: "@@ -1,3 +1,3 @@\n a\n-b\n+B\n c\n" }, ctx(ws, "plan"));
    expect(res.ok).toBe(false);
    expect(readFileSync(join(ws, "f.txt"), "utf8")).toBe(FILE);
  });

  it("reports a friendly error for a missing file", async () => {
    const res = await applyPatchTool.run({ path: "nope.txt", patch: "@@ -1,1 +1,1 @@\n-a\n+b\n" }, ctx(workspace()));
    expect(res.ok).toBe(false);
    expect(res.output).toMatch(/Could not read file to patch/);
  });
});
