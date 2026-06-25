import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findFilesTool } from "../src/core/tools/find-files.js";
import { PermissionEngine } from "../src/core/permissions/modes.js";

const dirs: string[] = [];
function workspace(): string {
  const d = mkdtempSync(join(tmpdir(), "polypus-find-"));
  dirs.push(d);
  return d;
}
function ctx(ws: string, allow = ["**/*"], deny: string[] = []) {
  return {
    workspace: ws,
    permissions: new PermissionEngine({ mode: "bypass" as const, policy: { workspace: ws, allow, deny }, allowedCommands: [] }),
  };
}
function seed(ws: string) {
  mkdirSync(join(ws, "src"));
  mkdirSync(join(ws, "src", "nested"));
  mkdirSync(join(ws, "node_modules"));
  writeFileSync(join(ws, "src", "a.ts"), "");
  writeFileSync(join(ws, "src", "a.test.ts"), "");
  writeFileSync(join(ws, "src", "nested", "b.test.ts"), "");
  writeFileSync(join(ws, "src", "c.js"), "");
  writeFileSync(join(ws, "node_modules", "dep.test.ts"), "");
  writeFileSync(join(ws, "readme.md"), "");
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

describe("find_files tool", () => {
  it("returns paths matching the glob, recursively, skipping node_modules", async () => {
    const ws = workspace();
    seed(ws);
    const res = await findFilesTool.run({ glob: "src/**/*.test.ts" }, ctx(ws));
    expect(res.ok).toBe(true);
    expect(res.output).toContain("src/a.test.ts");
    expect(res.output).toContain("src/nested/b.test.ts");
    expect(res.output).not.toContain("src/a.ts");
    expect(res.output).not.toContain("node_modules");
  });

  it("reports a friendly message when nothing matches", async () => {
    const ws = workspace();
    seed(ws);
    const res = await findFilesTool.run({ glob: "**/*.py" }, ctx(ws));
    expect(res.ok).toBe(true);
    expect(res.output).toMatch(/No files match/);
  });

  it("honours max_results and marks truncation (coerced from string)", async () => {
    const ws = workspace();
    seed(ws);
    const res = await findFilesTool.run({ glob: "**/*.ts", max_results: "1" }, ctx(ws));
    expect(res.ok).toBe(true);
    const paths = res.output.split("\n").filter((l) => l.endsWith(".ts"));
    expect(paths).toHaveLength(1);
    expect(res.output).toContain("1+ file(s)");
  });

  it("excludes files hidden by the deny-list", async () => {
    const ws = workspace();
    writeFileSync(join(ws, "keep.env"), "");
    writeFileSync(join(ws, "ok.txt"), "");
    const res = await findFilesTool.run({ glob: "**/*" }, ctx(ws, ["**/*"], ["*.env"]));
    expect(res.output).toContain("ok.txt");
    expect(res.output).not.toContain("keep.env");
  });

  it("rejects missing glob", async () => {
    const res = await findFilesTool.run({}, ctx(workspace()));
    expect(res.ok).toBe(false);
    expect(res.output).toMatch(/'glob' is required/);
  });
});
