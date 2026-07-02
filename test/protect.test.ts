import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { protectPaths, isProtected } from "../src/core/permissions/protect.js";
import { PermissionEngine } from "../src/core/permissions/modes.js";

describe("isProtected", () => {
  it("matches globs against workspace-relative paths", () => {
    expect(isProtected(["config.mjs"], "config.mjs")).toBe(true);
    expect(isProtected(["src/**"], "src/secrets/key.mjs")).toBe(true);
    expect(isProtected(["config.mjs"], "other.mjs")).toBe(false);
    expect(isProtected([], "config.mjs")).toBe(false);
  });
});

describe("protectPaths", () => {
  let ws: string;
  beforeEach(async () => {
    ws = await mkdtemp(join(tmpdir(), "polypus-protect-"));
    await writeFile(join(ws, "config.mjs"), "export const A = 1;\n");
    await writeFile(join(ws, "free.mjs"), "export const B = 2;\n");
  });
  afterEach(async () => {
    await rm(ws, { recursive: true, force: true });
  });

  it("makes matched files read-only and restores them", async () => {
    const { files, restore } = await protectPaths(ws, ["config.mjs"]);
    expect(files).toHaveLength(1);

    // Writing the protected file now fails at the OS level.
    await expect(writeFile(join(ws, "config.mjs"), "hacked")).rejects.toBeTruthy();
    // A non-matched file stays writable.
    await expect(writeFile(join(ws, "free.mjs"), "ok")).resolves.toBeUndefined();

    await restore();
    // After restore the file is writable again and its content was never changed.
    expect(await readFile(join(ws, "config.mjs"), "utf8")).toBe("export const A = 1;\n");
    await expect(writeFile(join(ws, "config.mjs"), "now ok")).resolves.toBeUndefined();
  });

  it("no-ops on an empty glob list", async () => {
    const { files } = await protectPaths(ws, []);
    expect(files).toHaveLength(0);
  });
});

describe("PermissionEngine + protect", () => {
  const policy = { workspace: "/ws", allow: ["**/*"], deny: [] as string[] };

  it("denies writes to a protected path even in bypass mode", async () => {
    const engine = new PermissionEngine({
      mode: "bypass",
      policy,
      protect: ["config.mjs"],
      allowedCommands: [],
    });
    const d = await engine.authorizeWrite("config.mjs", undefined, "x");
    expect(d.allowed).toBe(false);
    expect(d.reason).toMatch(/protected/i);
  });

  it("allows writes to non-protected paths", async () => {
    const engine = new PermissionEngine({
      mode: "bypass",
      policy,
      protect: ["config.mjs"],
      allowedCommands: [],
    });
    const d = await engine.authorizeWrite("other.mjs", undefined, "x");
    expect(d.allowed).toBe(true);
  });
});
