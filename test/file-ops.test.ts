import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { deleteFileTool } from "../src/core/tools/delete-file.js";
import { moveFileTool } from "../src/core/tools/move-file.js";
import { PermissionEngine } from "../src/core/permissions/modes.js";
import type { PermissionMode } from "../src/core/config/schema.js";

const dirs: string[] = [];
function workspace(): string {
  const d = mkdtempSync(join(tmpdir(), "polypus-fileops-"));
  dirs.push(d);
  return d;
}
function ctx(ws: string, mode: PermissionMode = "bypass", allow = ["**/*"], deny: string[] = []) {
  return {
    workspace: ws,
    permissions: new PermissionEngine({ mode, policy: { workspace: ws, allow, deny }, allowedCommands: [] }),
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

describe("delete_file tool", () => {
  it("deletes a file", async () => {
    const ws = workspace();
    writeFileSync(join(ws, "a.txt"), "x");
    const res = await deleteFileTool.run({ path: "a.txt" }, ctx(ws));
    expect(res.ok).toBe(true);
    expect(existsSync(join(ws, "a.txt"))).toBe(false);
  });

  it("deletes an empty directory but refuses a non-empty one", async () => {
    const ws = workspace();
    mkdirSync(join(ws, "empty"));
    mkdirSync(join(ws, "full"));
    writeFileSync(join(ws, "full", "f.txt"), "x");

    expect((await deleteFileTool.run({ path: "empty" }, ctx(ws))).ok).toBe(true);
    const refused = await deleteFileTool.run({ path: "full" }, ctx(ws));
    expect(refused.ok).toBe(false);
    expect(refused.output).toMatch(/non-empty directory/);
    expect(existsSync(join(ws, "full", "f.txt"))).toBe(true);
  });

  it("is blocked in plan mode and by the deny-list", async () => {
    const ws = workspace();
    writeFileSync(join(ws, "a.txt"), "x");
    writeFileSync(join(ws, "keep.env"), "TOKEN=1");
    expect((await deleteFileTool.run({ path: "a.txt" }, ctx(ws, "plan"))).ok).toBe(false);
    expect(existsSync(join(ws, "a.txt"))).toBe(true);
    const denied = await deleteFileTool.run({ path: "keep.env" }, ctx(ws, "bypass", ["**/*"], ["*.env"]));
    expect(denied.ok).toBe(false);
    expect(existsSync(join(ws, "keep.env"))).toBe(true);
  });

  it("reports a friendly error for a missing path", async () => {
    const res = await deleteFileTool.run({ path: "nope" }, ctx(workspace()));
    expect(res.ok).toBe(false);
    expect(res.output).toMatch(/Could not delete/);
  });
});

describe("move_file tool", () => {
  it("renames a file", async () => {
    const ws = workspace();
    writeFileSync(join(ws, "a.txt"), "hello");
    const res = await moveFileTool.run({ from: "a.txt", to: "b.txt" }, ctx(ws));
    expect(res.ok).toBe(true);
    expect(existsSync(join(ws, "a.txt"))).toBe(false);
    expect(readFileSync(join(ws, "b.txt"), "utf8")).toBe("hello");
  });

  it("creates destination parent directories", async () => {
    const ws = workspace();
    writeFileSync(join(ws, "a.txt"), "hello");
    const res = await moveFileTool.run({ from: "a.txt", to: "nested/deep/b.txt" }, ctx(ws));
    expect(res.ok).toBe(true);
    expect(readFileSync(join(ws, "nested", "deep", "b.txt"), "utf8")).toBe("hello");
  });

  it("is blocked in plan mode and by the deny-list on either end", async () => {
    const ws = workspace();
    writeFileSync(join(ws, "a.txt"), "x");
    expect((await moveFileTool.run({ from: "a.txt", to: "b.txt" }, ctx(ws, "plan"))).ok).toBe(false);
    const toEnv = await moveFileTool.run({ from: "a.txt", to: "secret.env" }, ctx(ws, "bypass", ["**/*"], ["*.env"]));
    expect(toEnv.ok).toBe(false);
    expect(toEnv.output).toMatch(/destination/);
  });

  it("reports a friendly error when the source is missing", async () => {
    const res = await moveFileTool.run({ from: "nope.txt", to: "b.txt" }, ctx(workspace()));
    expect(res.ok).toBe(false);
    expect(res.output).toMatch(/Could not move/);
  });
});
