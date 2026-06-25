import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readFileTool } from "../src/core/tools/read-file.js";
import { PermissionEngine } from "../src/core/permissions/modes.js";

const dirs: string[] = [];
function workspace(): string {
  const d = mkdtempSync(join(tmpdir(), "polypus-read-"));
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
function file(ws: string, name: string, content: string): void {
  writeFileSync(join(ws, name), content);
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

const TEN = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join("\n");

describe("read_file (range)", () => {
  it("reads the whole file unchanged when no range is given", async () => {
    const ws = workspace();
    file(ws, "a.txt", TEN);
    const res = await readFileTool.run({ path: "a.txt" }, ctx(ws));
    expect(res.ok).toBe(true);
    expect(res.output).toBe(TEN); // no line numbers, no footer — backwards compatible
  });

  it("returns only the requested slice with line numbers", async () => {
    const ws = workspace();
    file(ws, "a.txt", TEN);
    const res = await readFileTool.run({ path: "a.txt", start_line: 3, end_line: 5 }, ctx(ws));
    expect(res.ok).toBe(true);
    expect(res.output).toContain("3| line 3");
    expect(res.output).toContain("5| line 5");
    expect(res.output).not.toContain("line 2");
    expect(res.output).not.toContain("line 6");
    expect(res.output).toContain("(lines 3-5 of 10)");
  });

  it("coerces string bounds (emulated path passes args as strings)", async () => {
    const ws = workspace();
    file(ws, "a.txt", TEN);
    const res = await readFileTool.run({ path: "a.txt", start_line: "2", end_line: "2" }, ctx(ws));
    expect(res.ok).toBe(true);
    expect(res.output).toContain("2| line 2");
    expect(res.output).toContain("(lines 2-2 of 10)");
  });

  it("clamps an over-wide range to the file bounds", async () => {
    const ws = workspace();
    file(ws, "a.txt", TEN);
    const res = await readFileTool.run({ path: "a.txt", start_line: 8, end_line: 999 }, ctx(ws));
    expect(res.ok).toBe(true);
    expect(res.output).toContain("8| line 8");
    expect(res.output).toContain("10| line 10");
    expect(res.output).toContain("(lines 8-10 of 10)");
  });

  it("rejects start_line after end_line", async () => {
    const ws = workspace();
    file(ws, "a.txt", TEN);
    const res = await readFileTool.run({ path: "a.txt", start_line: 6, end_line: 2 }, ctx(ws));
    expect(res.ok).toBe(false);
    expect(res.output).toMatch(/start_line .* is after end_line/);
  });

  it("reports a start_line past the end of the file", async () => {
    const ws = workspace();
    file(ws, "a.txt", TEN);
    const res = await readFileTool.run({ path: "a.txt", start_line: 50 }, ctx(ws));
    expect(res.ok).toBe(false);
    expect(res.output).toMatch(/past the end of the file/);
  });

  it("honours the deny-list", async () => {
    const ws = workspace();
    file(ws, "secret.env", "TOKEN=abc");
    const res = await readFileTool.run({ path: "secret.env", start_line: 1 }, ctx(ws, ["**/*"], ["*.env"]));
    expect(res.ok).toBe(false);
    expect(res.output).toMatch(/denied/i);
  });
});
