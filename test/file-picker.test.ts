import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listWorkspaceFiles, matches } from "../src/ui/file-picker.js";

const dirs: string[] = [];
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "poly-picker-"));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) {
    try { rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

describe("matches", () => {
  it("is a case-insensitive subsequence test", () => {
    expect(matches("src/service.ts", "srvc")).toBe(true);
    expect(matches("src/service.ts", "SERVICE")).toBe(true);
    expect(matches("README.md", "")).toBe(true); // empty query matches everything
    expect(matches("src/index.ts", "zzz")).toBe(false);
  });
});

describe("listWorkspaceFiles", () => {
  it("lists files recursively with POSIX paths and skips noise dirs", async () => {
    const ws = tmp();
    mkdirSync(join(ws, "src"), { recursive: true });
    mkdirSync(join(ws, "node_modules", "pkg"), { recursive: true });
    mkdirSync(join(ws, ".git"), { recursive: true });
    writeFileSync(join(ws, "README.md"), "x");
    writeFileSync(join(ws, "src", "index.ts"), "x");
    writeFileSync(join(ws, "node_modules", "pkg", "junk.js"), "x");
    writeFileSync(join(ws, ".git", "config"), "x");

    const files = await listWorkspaceFiles(ws);
    expect(files).toContain("README.md");
    expect(files).toContain("src/index.ts");
    expect(files.some((f) => f.includes("node_modules"))).toBe(false);
    expect(files.some((f) => f.includes(".git"))).toBe(false);
  });
});
