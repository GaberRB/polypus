import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runPythonScriptTool, findInterpreter } from "../src/core/tools/run-python-script.js";
import { PermissionEngine } from "../src/core/permissions/modes.js";
import type { PermissionMode } from "../src/core/config/schema.js";

const dirs: string[] = [];
function workspace(): string {
  const d = mkdtempSync(join(tmpdir(), "polypus-py-"));
  dirs.push(d);
  return d;
}
function ctx(ws: string, mode: PermissionMode = "bypass") {
  return {
    workspace: ws,
    permissions: new PermissionEngine({
      mode,
      policy: { workspace: ws, allow: ["**/*"], deny: [] },
      allowedCommands: [],
    }),
  };
}

// The execution tests need a real interpreter; skip them when none is installed so
// CI on a Python-less machine stays green. Reuse the tool's own detection so the
// guard can never diverge from what the tool actually runs.
const whenPython = findInterpreter() !== null ? it : it.skip;

afterEach(() => {
  for (const d of dirs.splice(0)) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

describe("run_python_script tool", () => {
  it("rejects missing script without executing", async () => {
    const res = await runPythonScriptTool.run({}, ctx(workspace()));
    expect(res.ok).toBe(false);
    expect(res.output).toMatch(/'script' is required/);
  });

  it("is denied in plan mode (mutating, gated by the permission engine)", async () => {
    const res = await runPythonScriptTool.run({ script: "print('nope')" }, ctx(workspace(), "plan"));
    expect(res.ok).toBe(false);
    expect(res.output).toMatch(/denied/i);
  });

  whenPython("runs an inline script and returns its stdout", async () => {
    const res = await runPythonScriptTool.run({ script: "print('hi')" }, ctx(workspace()));
    expect(res.ok).toBe(true);
    expect(res.output).toBe("hi");
  });

  whenPython("reads a structured file from the workspace", async () => {
    const ws = workspace();
    writeFileSync(join(ws, "data.json"), JSON.stringify({ name: "polypus", version: 42 }));
    const res = await runPythonScriptTool.run(
      { script: "import json; print(json.load(open('data.json'))['version'])" },
      ctx(ws),
    );
    expect(res.ok).toBe(true);
    expect(res.output).toBe("42");
  });

  whenPython("feeds the script over stdin, so shell metacharacters are inert (no injection)", async () => {
    // Single quotes, semicolons and newlines would break a `python -c "…"` shell command;
    // over stdin they are just Python source.
    const res = await runPythonScriptTool.run(
      { script: "print('a'); print(\"b;c\")\nprint('d\\'e')" },
      ctx(workspace()),
    );
    expect(res.ok).toBe(true);
    // Normalize CRLF: Windows Python prints \r\n, the test must pass on every platform.
    expect(res.output.replace(/\r\n/g, "\n")).toBe("a\nb;c\nd'e");
  });

  whenPython("reports a non-zero exit with the traceback instead of throwing", async () => {
    const res = await runPythonScriptTool.run({ script: "print(undefined_variable)" }, ctx(workspace()));
    expect(res.ok).toBe(false);
    expect(res.output).toMatch(/Python script failed/);
    expect(res.output).toMatch(/NameError/);
  });

  whenPython("clamps oversized output instead of returning it all", async () => {
    const res = await runPythonScriptTool.run({ script: "print('x' * 30000)" }, ctx(workspace()));
    expect(res.ok).toBe(true);
    expect(res.output).toContain("[truncated]");
    // Bounded to the clamp size plus the short marker.
    expect(res.output.length).toBeLessThan(20_100);
  });
});
