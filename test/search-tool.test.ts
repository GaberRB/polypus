import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { searchTool } from "../src/core/tools/search-file.js";
import { PermissionEngine } from "../src/core/permissions/modes.js";

const dirs: string[] = [];
function workspace(): string {
  const d = mkdtempSync(join(tmpdir(), "polypus-search-"));
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

describe("search tool", () => {
  it("finds a regex match and reports path:line", async () => {
    const ws = workspace();
    mkdirSync(join(ws, "src"));
    writeFileSync(join(ws, "src", "a.ts"), "const x = 1;\nexport function createProvider() {}\n");
    writeFileSync(join(ws, "src", "b.ts"), "// nothing here\n");

    const res = await searchTool.run({ query: "createProvider\\(" }, ctx(ws));
    expect(res.ok).toBe(true);
    expect(res.output).toContain("src/a.ts:2:");
    expect(res.output).not.toContain("src/b.ts");
  });

  it("respects the glob filter", async () => {
    const ws = workspace();
    mkdirSync(join(ws, "src"));
    writeFileSync(join(ws, "src", "a.ts"), "TODO: fix\n");
    writeFileSync(join(ws, "notes.md"), "TODO: fix\n");

    const res = await searchTool.run({ query: "TODO", glob: "src/**/*.ts" }, ctx(ws));
    expect(res.ok).toBe(true);
    expect(res.output).toContain("src/a.ts");
    expect(res.output).not.toContain("notes.md");
  });

  it("skips files denied by the deny-list", async () => {
    const ws = workspace();
    writeFileSync(join(ws, "secret.env"), "TOKEN=abc\n");
    writeFileSync(join(ws, "ok.txt"), "TOKEN=visible\n");

    const res = await searchTool.run({ query: "TOKEN" }, ctx(ws, ["**/*"], ["*.env"]));
    expect(res.ok).toBe(true);
    expect(res.output).toContain("ok.txt");
    expect(res.output).not.toContain("secret.env");
  });

  it("honours max_results", async () => {
    const ws = workspace();
    writeFileSync(join(ws, "many.txt"), Array.from({ length: 10 }, () => "match").join("\n"));

    const res = await searchTool.run({ query: "match", max_results: 3 }, ctx(ws));
    expect(res.ok).toBe(true);
    const lines = res.output.split("\n").filter((l) => l.includes("many.txt:"));
    expect(lines).toHaveLength(3);
  });

  it("ignores node_modules", async () => {
    const ws = workspace();
    mkdirSync(join(ws, "node_modules"));
    writeFileSync(join(ws, "node_modules", "dep.js"), "needle\n");
    writeFileSync(join(ws, "app.js"), "needle\n");

    const res = await searchTool.run({ query: "needle" }, ctx(ws));
    expect(res.output).toContain("app.js");
    expect(res.output).not.toContain("node_modules");
  });

  it("reports invalid regex instead of throwing", async () => {
    const ws = workspace();
    const res = await searchTool.run({ query: "(" }, ctx(ws));
    expect(res.ok).toBe(false);
    expect(res.output).toMatch(/Invalid regular expression/);
  });

  it("returns a friendly message when there are no matches", async () => {
    const ws = workspace();
    writeFileSync(join(ws, "a.txt"), "hello\n");
    const res = await searchTool.run({ query: "zzz" }, ctx(ws));
    expect(res.ok).toBe(true);
    expect(res.output).toMatch(/No matches/);
  });
});
