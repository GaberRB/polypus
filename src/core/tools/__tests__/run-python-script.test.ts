import { describe, it, expect, vi } from "vitest";
import { runPythonScriptTool } from "../run-python-script.js";
import type { ToolContext, Decision } from "../types.js";

import { PermissionEngine } from "../../permissions/modes.js";

const mockCtx: ToolContext = {
  workspace: ".",
  permissions: {
    authorizeRead: (target: string) => ({ allowed: true, reason: "" } as Decision),
    authorizeWrite: async (target: string, preview?: string, content?: string) => ({ allowed: true, reason: "" } as Decision),
    authorizeCommand: async (command: string) => ({ allowed: true, reason: "" } as Decision),
    mode: "bypass",
    opts: {},
  } as unknown as PermissionEngine,
};

describe("runPythonScriptTool", () => {
  it("should execute a Python script and return the output", async () => {
    const result = await runPythonScriptTool.run(
      { script: "print('Hello, Python!')" },
      mockCtx
    );

    expect(result).toEqual({
      ok: true,
      output: "Hello, Python!",
    });
  });

  it("should handle Python script errors", async () => {
    const result = await runPythonScriptTool.run(
      { script: "print(undefined_variable)" },
      mockCtx
    );

    expect(result.ok).toBe(false);
    expect(result.output).toContain("Python script error");
  });
});
