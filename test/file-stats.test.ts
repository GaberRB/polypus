import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { fileStatsTool } from "../src/core/tools/file-stats.js";
import { PermissionEngine } from "../src/core/permissions/modes.js";

const dirs: string[] = [];
function workspace(): string {
  const d = mkdtempSync(join(tmpdir(), "polypus-stat-"));
  dirs.push(d);
  return d;
}
function ctx(ws: string, allow = ["**/*"], deny: string[] = []) {
  return {
    workspace: ws,
    permissions: new PermissionEngine({
      mode: "bypass" as const,
      policy: { workspace: ws, allow, deny },
      allowedCommands: [],
    }),
  };
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

describe("file_stats tool", () => {
  it("reports metadata for a file", async () => {
    const ws = workspace();
    writeFileSync(join(ws, "a.txt"), "hello");
    const res = await fileStatsTool.run({ path: "a.txt" }, ctx(ws));
    expect(res.ok).toBe(true);
    const info = JSON.parse(res.output);
    expect(info).toMatchObject({ path: "a.txt", size: 5, isFile: true, isDir: false, isSymlink: false });
    expect(typeof info.mtime).toBe("string");
  });

  it("reports a directory", async () => {
    const ws = workspace();
    mkdirSync(join(ws, "sub"));
    const res = await fileStatsTool.run({ path: "sub" }, ctx(ws));
    expect(res.ok).toBe(true);
    expect(JSON.parse(res.output)).toMatchObject({ isDir: true, isFile: false });
  });

  it("returns a friendly error for a missing path", async () => {
    const res = await fileStatsTool.run({ path: "nope.txt" }, ctx(workspace()));
    expect(res.ok).toBe(false);
    expect(res.output).toMatch(/Could not stat path/);
  });

  it("honours the deny-list", async () => {
    const ws = workspace();
    writeFileSync(join(ws, "secret.env"), "TOKEN=abc");
    const res = await fileStatsTool.run({ path: "secret.env" }, ctx(ws, ["**/*"], ["*.env"]));
    expect(res.ok).toBe(false);
    expect(res.output).toMatch(/denied/i);
  });

  it("rejects missing args", async () => {
    const res = await fileStatsTool.run({}, ctx(workspace()));
    expect(res.ok).toBe(false);
    expect(res.output).toMatch(/'path' is required/);
  });
});
