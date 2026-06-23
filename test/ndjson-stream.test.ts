import { describe, expect, it } from "vitest";
import { createNdjsonStreamer, type StreamEvent } from "../src/cli/commands/json-output.js";
import type { RunResult } from "../src/core/agent/loop.js";
import type { ToolCall } from "../src/core/providers/types.js";

const call = (name: string, args: Record<string, unknown>): ToolCall => ({ id: "1", name, arguments: args });

describe("createNdjsonStreamer", () => {
  it("emits one event per agent callback, in order, then a final result", () => {
    const out: StreamEvent[] = [];
    const s = createNdjsonStreamer((e) => out.push(e));

    s.events.onStep?.(1);
    s.events.onAssistantDelta?.("hel");
    s.events.onAssistantDelta?.("lo");
    s.events.onToolCall?.(call("write_file", { path: "a.ts", content: "x" }));
    s.events.onToolResult?.(call("write_file", { path: "a.ts" }), { ok: true, output: "wrote" });
    s.finalize({
      reason: "finished",
      finished: true,
      steps: 1,
      summary: "done",
      usage: { promptTokens: 1, completionTokens: 2 },
      messages: [],
    } as unknown as RunResult);

    expect(out.map((e) => e.type)).toEqual([
      "step",
      "assistant_delta",
      "assistant_delta",
      "tool_call",
      "tool_result",
      "result",
    ]);
    // Live token chunks are preserved verbatim.
    expect(out.filter((e) => e.type === "assistant_delta").map((e) => e.text)).toEqual(["hel", "lo"]);
    // filesChanged is derived from successful write_file/edit_file calls.
    const result = out.at(-1) as { result: { reason: string; filesChanged: string[] } };
    expect(result.result.reason).toBe("finished");
    expect(result.result.filesChanged).toEqual(["a.ts"]);
  });

  it("does not record filesChanged for a failed write", () => {
    const out: StreamEvent[] = [];
    const s = createNdjsonStreamer((e) => out.push(e));
    s.events.onToolResult?.(call("write_file", { path: "a.ts" }), { ok: false, output: "denied" });
    s.finalize({ reason: "finished", finished: true, steps: 1, usage: {}, messages: [] } as unknown as RunResult);
    const result = out.at(-1) as { result: { filesChanged: string[] } };
    expect(result.result.filesChanged).toEqual([]);
  });
});
