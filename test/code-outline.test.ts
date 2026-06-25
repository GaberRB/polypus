import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { codeOutlineTool, outlineTsJs } from "../src/core/tools/code-outline.js";
import { PermissionEngine } from "../src/core/permissions/modes.js";

const dirs: string[] = [];
function workspace(): string {
  const d = mkdtempSync(join(tmpdir(), "polypus-outline-"));
  dirs.push(d);
  return d;
}
function ctx(ws: string) {
  return {
    workspace: ws,
    permissions: new PermissionEngine({ mode: "bypass" as const, policy: { workspace: ws, allow: ["**/*"], deny: [] }, allowedCommands: [] }),
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

const SRC = [
  "import x from 'y';",
  "export function foo() {}",
  "  function notTopLevel() {}",
  "export default class Bar {",
  "  method() {}",
  "}",
  "interface Shape { x: number }",
  "export type ID = string;",
  "enum Color { Red }",
  "export const handler = async (req) => {};",
  "const obj = { a: 1 };",
  "let counter = 0;",
].join("\n");

describe("outlineTsJs (pure)", () => {
  it("finds top-level symbols and skips indented members and plain values", () => {
    const syms = outlineTsJs(SRC);
    const names = syms.map((s) => `${s.kind}:${s.name}`);
    expect(names).toContain("function:foo");
    expect(names).toContain("class:Bar");
    expect(names).toContain("interface:Shape");
    expect(names).toContain("type:ID");
    expect(names).toContain("enum:Color");
    expect(names).toContain("const:handler"); // arrow function const
    expect(names).not.toContain("function:notTopLevel"); // indented
    expect(names).not.toContain("const:obj"); // plain object, not a function
    expect(names).not.toContain("const:counter"); // plain value
  });

  it("reports correct 1-based line numbers", () => {
    const syms = outlineTsJs(SRC);
    expect(syms.find((s) => s.name === "foo")!.line).toBe(2);
  });
});

describe("code_outline tool", () => {
  it("outlines a TS file on disk", async () => {
    const ws = workspace();
    writeFileSync(join(ws, "m.ts"), SRC);
    const res = await codeOutlineTool.run({ path: "m.ts" }, ctx(ws));
    expect(res.ok).toBe(true);
    expect(res.output).toContain("2: function foo");
    expect(res.output).toContain("class Bar");
  });

  it("rejects unsupported file types", async () => {
    const ws = workspace();
    writeFileSync(join(ws, "data.py"), "def x(): pass");
    const res = await codeOutlineTool.run({ path: "data.py" }, ctx(ws));
    expect(res.ok).toBe(false);
    expect(res.output).toMatch(/TypeScript\/JavaScript files only/);
  });

  it("reports a friendly error for a missing file", async () => {
    const res = await codeOutlineTool.run({ path: "nope.ts" }, ctx(workspace()));
    expect(res.ok).toBe(false);
    expect(res.output).toMatch(/Could not read file/);
  });
});
