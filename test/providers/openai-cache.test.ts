import { describe, expect, it } from "vitest";
import {
  aggregateStream,
  applyOpenRouterCache,
  type StreamChunk,
} from "../../src/core/providers/openai-compatible.js";

describe("applyOpenRouterCache", () => {
  const msgs = [
    { role: "system", content: "sys" },
    { role: "user", content: "hi" },
  ] as any;

  it("injects cache_control on system and last message for claude models", () => {
    const out = applyOpenRouterCache(msgs, "anthropic/claude-3.5-sonnet", true) as any;
    expect(out[0].content[0].cache_control).toEqual({ type: "ephemeral" });
    expect(out[1].content[0].cache_control).toEqual({ type: "ephemeral" });
  });

  it("is a no-op (same reference) for non-anthropic models", () => {
    const out = applyOpenRouterCache(msgs, "openai/gpt-4o", true);
    expect(out).toBe(msgs);
  });

  it("is a no-op when disabled", () => {
    const out = applyOpenRouterCache(msgs, "anthropic/claude-3", false);
    expect(out).toBe(msgs);
  });

  it("does not rewrite messages whose content is not a plain string", () => {
    const withToolCall = [
      { role: "system", content: "s" },
      { role: "assistant", content: null, tool_calls: [] },
    ] as any;
    const out = applyOpenRouterCache(withToolCall, "claude", true) as any;
    expect(out[1]).toBe(withToolCall[1]); // assistant untouched
    expect(out[0].content[0].cache_control).toEqual({ type: "ephemeral" });
  });
});

describe("aggregateStream cache telemetry", () => {
  it("captures cached_tokens from the streamed usage", async () => {
    async function* gen(): AsyncIterable<StreamChunk> {
      yield { choices: [{ delta: { content: "hi" } }] };
      yield {
        choices: [{ finish_reason: "stop" }],
        usage: { prompt_tokens: 100, completion_tokens: 10, prompt_tokens_details: { cached_tokens: 80 } },
      };
    }
    const agg = await aggregateStream(gen());
    expect(agg.usage?.promptTokens).toBe(100);
    expect(agg.usage?.cacheReadTokens).toBe(80);
  });
});
