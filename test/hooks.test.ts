import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadHooks, runAfterHook, runPostToolUseHooks, runPreToolUseHooks, runStopHooks, screenCommandHook } from "../src/core/agent/hooks.js";
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

describe("runPostToolUseHooks", () => {
  it("runs a PostToolUse hook and returns output + blocked=false", async () => {
    const ws = workspace();
    const marker = join(ws, "ran.txt").replace(/\\/g, "/");
    const results = await runPostToolUseHooks(
      {
        hooks: [{ event: "PostToolUse", on: "write_file", command: `node -e "require('fs').writeFileSync('${marker}','{path}')"`, timeout: 10000, maxOutputChars: 1000 }],
      },
      call("write_file", { path: "src/x.ts" }),
      ws,
    );
    expect(results).toHaveLength(1);
    expect(results[0]!.blocked).toBe(false);
    expect(existsSync(join(ws, "ran.txt"))).toBe(true);
  });

  it("returns empty array when no hook matches", async () => {
    const results = await runPostToolUseHooks(
      { hooks: [{ event: "PostToolUse", on: "edit_file", command: "echo x", timeout: 10000, maxOutputChars: 1000 }] },
      call("write_file", { path: "a" }),
      workspace(),
    );
    expect(results).toHaveLength(0);
  });

  it("returns blocked=true when hook exits non-zero", async () => {
    const results = await runPostToolUseHooks(
      { hooks: [{ event: "PostToolUse", on: "*", command: "node -e \"process.exit(1)\"", timeout: 10000, maxOutputChars: 1000 }] },
      call("write_file", { path: "a" }),
      workspace(),
    );
    expect(results[0]!.blocked).toBe(true);
  });
});

describe("runPreToolUseHooks", () => {
  it("blocks on non-zero exit and returns blocked=true", async () => {
    const results = await runPreToolUseHooks(
      { hooks: [{ event: "PreToolUse", on: "run_command", command: "node -e \"process.exit(1)\"", timeout: 10000, maxOutputChars: 1000 }] },
      call("run_command", { command: "echo hi" }),
      workspace(),
    );
    expect(results[0]!.blocked).toBe(true);
  });

  it("blocks via legacy deny-list", async () => {
    const results = await runPreToolUseHooks(
      { hooks: [], beforeCommand: { deny: ["rm -rf"] } },
      call("run_command", { command: "rm -rf /" }),
      workspace(),
    );
    expect(results[0]!.blocked).toBe(true);
  });
});

describe("runStopHooks", () => {
  it("runs Stop hooks and returns output", async () => {
    const ws = workspace();
    const results = await runStopHooks(
      { hooks: [{ event: "Stop", on: "*", command: "node -e \"console.log('done')\"", timeout: 10000, maxOutputChars: 1000 }] },
      ws,
    );
    expect(results).toHaveLength(1);
    expect(results[0]!.output).toContain("done");
    expect(results[0]!.blocked).toBe(false);
  });
});

describe("runAfterHook (deprecated shim)", () => {
  it("still works via legacy afterWrite field", async () => {
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
