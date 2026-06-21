import { describe, expect, it } from "vitest";
import { aggregateStream, type StreamChunk } from "../src/core/providers/openai-compatible.js";

async function* iter(chunks: StreamChunk[]): AsyncIterable<StreamChunk> {
  for (const c of chunks) yield c;
}

describe("aggregateStream", () => {
  it("concatenates text content and forwards each chunk to onDelta", async () => {
    const deltas: string[] = [];
    const agg = await aggregateStream(
      iter([
        { choices: [{ delta: { content: "Hel" } }] },
        { choices: [{ delta: { content: "lo " } }] },
        { choices: [{ delta: { content: "world" }, finish_reason: "stop" }] },
        { choices: [], usage: { prompt_tokens: 10, completion_tokens: 3 } },
      ]),
      (c) => deltas.push(c),
    );
    expect(agg.content).toBe("Hello world");
    expect(deltas).toEqual(["Hel", "lo ", "world"]);
    expect(agg.finishReason).toBe("stop");
    expect(agg.usage).toEqual({ promptTokens: 10, completionTokens: 3 });
    expect(agg.toolCalls).toEqual([]);
  });

  it("aggregates streamed tool-call deltas by index", async () => {
    const agg = await aggregateStream(
      iter([
        { choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "write_file" } }] } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"path":"a' } }] } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '.ts"}' } }] }, finish_reason: "tool_calls" }] },
      ]),
    );
    expect(agg.toolCalls).toHaveLength(1);
    expect(agg.toolCalls[0]).toEqual({ id: "call_1", name: "write_file", arguments: '{"path":"a.ts"}' });
    expect(agg.finishReason).toBe("tool_calls");
  });

  it("handles multiple parallel tool calls and empty chunks", async () => {
    const agg = await aggregateStream(
      iter([
        { choices: [{ delta: { tool_calls: [{ index: 0, id: "a", function: { name: "x", arguments: "{}" } }] } }] },
        { choices: [{ delta: { tool_calls: [{ index: 1, id: "b", function: { name: "y", arguments: "{}" } }] } }] },
        { choices: [{ delta: {} }] },
      ]),
    );
    expect(agg.toolCalls.map((t) => t.name)).toEqual(["x", "y"]);
  });
});
