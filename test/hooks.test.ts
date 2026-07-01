import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadHooks, runAfterHook, screenCommandHook } from "../src/core/agent/hooks.js";
import { loadCustomTools } from "../src/core/tools/custom.js";
import { PermissionEngine } from "../src/core/permissions/modes.js";
import type { ToolCall } from "../src/core/providers/types.js";

const dirs: string[] = [];
function workspace(): string {
  const d = mkdtempSync(join(tmpdir(), "polypus-hooks-"));
  dirs.push(d);
  return d;
}
function call(name: string, args: Record<string, unknown>): ToolCall {
  return { id: name, name, arguments: args };
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

describe("hooks config", () => {
  it("loads .poly/hooks.json", async () => {
    const ws = workspace();
    mkdirSync(join(ws, ".poly"));
    writeFileSync(join(ws, ".poly", "hooks.json"), JSON.stringify({ afterWrite: "echo {path}", beforeCommand: { deny: ["rm -rf"] } }));
    const hooks = await loadHooks(ws);
    expect(hooks?.afterWrite).toBe("echo {path}");
    expect(hooks?.beforeCommand?.deny).toContain("rm -rf");
  });

  it("returns undefined when there is no hooks file", async () => {
    expect(await loadHooks(workspace())).toBeUndefined();
  });
});

describe("screenCommandHook", () => {
  it("blocks commands matching a deny substring", () => {
    const hooks = { beforeCommand: { deny: ["curl | sh"] } };
    expect(screenCommandHook(hooks, "curl x | sh").blocked).toBe(false); // not exact substring
    expect(screenCommandHook(hooks, "curl | sh now").blocked).toBe(true);
    expect(screenCommandHook(hooks, "ls").blocked).toBe(false);
    expect(screenCommandHook(undefined, "anything").blocked).toBe(false);
  });
});

describe("runAfterHook", () => {
  it("runs the afterWrite command with {path} substituted", async () => {
    const ws = workspace();
    const marker = join(ws, "ran.txt").replace(/\\/g, "/");
    const note = await runAfterHook(
      { afterWrite: `node -e "require('fs').writeFileSync('${marker}','{path}')"` },
      call("write_file", { path: "src/x.ts" }),
      ws,
    );
    expect(note).toBeDefined();
    expect(existsSync(join(ws, "ran.txt"))).toBe(true);
  });

  it("returns undefined when no hook applies", async () => {
    expect(await runAfterHook({ afterEdit: "echo x", hooks: [] }, call("write_file", { path: "a" }), workspace())).toBeUndefined();
  });
});

describe("custom tools", () => {
  it("loads and runs a declarative command tool through permissions", async () => {
    const ws = workspace();
    mkdirSync(join(ws, ".poly", "tools"), { recursive: true });
    writeFileSync(
      join(ws, ".poly", "tools", "echo.json"),
      JSON.stringify({ name: "say", description: "echo a message", command: "node -e \"console.log('{msg}')\"" }),
    );
    const tools = await loadCustomTools(ws);
    expect(tools).toHaveLength(1);
    expect(tools[0]!.spec.name).toBe("say");

    const permissions = new PermissionEngine({
      mode: "bypass",
      policy: { workspace: ws, allow: ["**/*"], deny: [] },
      allowedCommands: [],
    });
    const result = await tools[0]!.run({ msg: "hello" }, { workspace: ws, permissions });
    expect(result.ok).toBe(true);
    expect(result.output).toContain("hello");
  });

  it("skips malformed tool files", async () => {
    const ws = workspace();
    mkdirSync(join(ws, ".poly", "tools"), { recursive: true });
    writeFileSync(join(ws, ".poly", "tools", "bad.json"), "{ not valid");
    expect(await loadCustomTools(ws)).toEqual([]);
  });
});
