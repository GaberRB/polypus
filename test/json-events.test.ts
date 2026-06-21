import { describe, expect, it } from "vitest";
import { createJsonCollector } from "../src/cli/commands/json-output.js";
import type { RunResult } from "../src/core/agent/loop.js";
import type { ToolCall } from "../src/core/providers/types.js";

function call(name: string, args: Record<string, unknown>): ToolCall {
  return { id: name, name, arguments: args };
}

function fakeResult(over: Partial<RunResult> = {}): RunResult {
  return {
    finished: true,
    reason: "finished",
    summary: "done",
    steps: 2,
    messages: [],
    usage: { promptTokens: 10, completionTokens: 5 },
    ...over,
  };
}

describe("createJsonCollector", () => {
  it("derives filesChanged from successful write/edit calls without duplicates", () => {
    const c = createJsonCollector();
    c.events.onToolResult?.(call("write_file", { path: "a.ts" }), { ok: true, output: "wrote" });
    c.events.onToolResult?.(call("edit_file", { path: "a.ts" }), { ok: true, output: "edited" });
    c.events.onToolResult?.(call("edit_file", { path: "b.ts" }), { ok: true, output: "edited" });
    // a failed write must not count
    c.events.onToolResult?.(call("write_file", { path: "c.ts" }), { ok: false, output: "denied" });
    // run_command is not a file change
    c.events.onToolResult?.(call("run_command", { command: "ls" }), { ok: true, output: "" });

    const payload = c.build(fakeResult());
    expect(payload.result.filesChanged.sort()).toEqual(["a.ts", "b.ts"]);
  });

  it("captures the run result shape and the event log", () => {
    const c = createJsonCollector();
    c.events.onStep?.(1);
    c.events.onToolCall?.(call("read_file", { path: "x.ts" }));
    c.events.onAssistantText?.("hello");

    const payload = c.build(fakeResult({ reason: "finished", steps: 3 }));
    expect(payload.result).toMatchObject({
      reason: "finished",
      finished: true,
      steps: 3,
      summary: "done",
      filesChanged: [],
      usage: { promptTokens: 10, completionTokens: 5 },
    });
    expect(payload.events.map((e) => e.type)).toEqual(["step", "tool_call", "assistant"]);
    // The whole payload must be JSON-serializable.
    expect(() => JSON.stringify(payload)).not.toThrow();
  });

  it("ignores empty assistant text", () => {
    const c = createJsonCollector();
    c.events.onAssistantText?.("   ");
    const payload = c.build(fakeResult());
    expect(payload.events).toHaveLength(0);
  });
});
