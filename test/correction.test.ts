import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildCorrection } from "../src/core/agent/correction.js";
import type { ToolCall, ToolSpec } from "../src/core/providers/types.js";

const dirs: string[] = [];
function workspace(): string {
  const d = mkdtempSync(join(tmpdir(), "polypus-corr-"));
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

function call(name: string, args: Record<string, unknown>): ToolCall {
  return { id: "1", name, arguments: args };
}
const deps = (workspace: string, extra: Partial<Parameters<typeof buildCorrection>[2]> = {}) => ({
  workspace,
  allow: ["src/**"],
  ...extra,
});

const editSpec: ToolSpec = {
  name: "edit_file",
  description: "edit",
  parameters: {
    type: "object",
    properties: { path: { type: "string" }, search: { type: "string" }, replace: { type: "string" } },
    required: ["path", "search", "replace"],
  },
};

describe("buildCorrection", () => {
  it("shows the real file content when edit_file 'search' is not found", async () => {
    const ws = workspace();
    writeFileSync(join(ws, "a.ts"), "const answer = 42;\nconsole.log(answer);\n");

    const guidance = await buildCorrection(
      call("edit_file", { path: "a.ts", search: "const answer = 7;" }),
      "The 'search' text was not found. Re-read the file and try an exact snippet.",
      deps(ws),
    );

    expect(guidance).toBeTruthy();
    expect(guidance).toContain("AUTO-CORRECTION");
    expect(guidance).toContain("const answer = 42;"); // actual content surfaced
    expect(guidance).toMatch(/1 \| /); // line-numbered
  });

  it("reports the duplicate line numbers when edit_file 'search' is not unique", async () => {
    const ws = workspace();
    writeFileSync(join(ws, "a.ts"), "x = 1;\ny = 2;\nx = 1;\n");

    const guidance = await buildCorrection(
      call("edit_file", { path: "a.ts", search: "x = 1;" }),
      "The 'search' text matched 2 times; it must be unique. Include more surrounding context.",
      deps(ws),
    );

    expect(guidance).toContain("lines 1, 3");
  });

  it("lists nearby entries on a missing path (ENOENT)", async () => {
    const ws = workspace();
    mkdirSync(join(ws, "src"));
    writeFileSync(join(ws, "src", "index.ts"), "export {};\n");

    const guidance = await buildCorrection(
      call("read_file", { path: "src/nope.ts" }),
      "Could not read file: ENOENT: no such file or directory",
      deps(ws),
    );

    expect(guidance).toContain("index.ts");
  });

  it("surfaces the editable allow-list on a permission denial", async () => {
    const ws = workspace();
    const guidance = await buildCorrection(
      call("write_file", { path: "/etc/passwd", content: "x" }),
      "Write denied: path is outside the editable allow-list",
      deps(ws),
    );

    expect(guidance).toContain("src/**");
  });

  it("restates the schema on invalid arguments", async () => {
    const ws = workspace();
    const guidance = await buildCorrection(
      call("edit_file", { path: "a.ts" }),
      "edit_file needs three arguments: 'path', 'search', and 'replace'.",
      deps(ws, { toolSpec: editSpec }),
    );

    expect(guidance).toContain("search");
    expect(guidance).toContain("required");
  });

  it("returns null for an unrecognized error with no escalator", async () => {
    const ws = workspace();
    const guidance = await buildCorrection(
      call("run_command", { command: "weird" }),
      "some unexpected output that matches no rule",
      deps(ws),
    );

    expect(guidance).toBeNull();
  });

  it("falls back to the escalator for an unrecognized error", async () => {
    const ws = workspace();
    let escalated = false;
    const guidance = await buildCorrection(
      call("run_command", { command: "weird" }),
      "some unexpected output that matches no rule",
      deps(ws, {
        escalate: async () => {
          escalated = true;
          return "DIAGNOSIS: do X";
        },
      }),
    );

    expect(escalated).toBe(true);
    expect(guidance).toBe("DIAGNOSIS: do X");
  });
});
