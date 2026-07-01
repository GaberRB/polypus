import { afterEach, describe, expect, it, vi } from "vitest";
import { AnthropicProvider } from "../../src/core/providers/anthropic.js";
import type { ChatRequest } from "../../src/core/providers/types.js";

function makeProvider(): AnthropicProvider {
  return new AnthropicProvider({
    name: "a",
    model: "claude-x",
    baseURL: "https://api.anthropic.com",
    apiKey: "k",
  });
}

interface Capture {
  body?: any;
}

function stubFetch(cap: Capture): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body: string }) => {
      cap.body = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: "hi" }],
          stop_reason: "end_turn",
          usage: {
            input_tokens: 10,
            output_tokens: 5,
            cache_read_input_tokens: 100,
            cache_creation_input_tokens: 20,
          },
        }),
      };
    }),
  );
}

const req: ChatRequest = {
  messages: [
    { role: "system", content: "sys" },
    { role: "user", content: "hello" },
  ],
  tools: [
    { name: "t1", description: "d", parameters: {} },
    { name: "t2", description: "d", parameters: {} },
  ],
};

describe("AnthropicProvider prompt caching", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("marks cache_control on the last tool, system, and last message by default", async () => {
    const cap: Capture = {};
    stubFetch(cap);
    await makeProvider().chat(req);

    expect(cap.body.tools.at(-1).cache_control).toEqual({ type: "ephemeral" });
    expect(cap.body.tools[0].cache_control).toBeUndefined();

    expect(Array.isArray(cap.body.system)).toBe(true);
    expect(cap.body.system.at(-1).cache_control).toEqual({ type: "ephemeral" });

    const lastMsg = cap.body.messages.at(-1);
    expect(lastMsg.content.at(-1).cache_control).toEqual({ type: "ephemeral" });
  });

  it("omits cache_control entirely when caching is disabled", async () => {
    const cap: Capture = {};
    stubFetch(cap);
    await makeProvider().chat({ ...req, params: { cache: false } });

    expect(cap.body.tools.at(-1).cache_control).toBeUndefined();
    expect(typeof cap.body.system).toBe("string");
    expect(cap.body.messages.at(-1).content.at(-1).cache_control).toBeUndefined();
  });

  it("reports cache tokens and folds them into promptTokens", async () => {
    stubFetch({});
    const res = await makeProvider().chat(req);
    expect(res.usage?.cacheReadTokens).toBe(100);
    expect(res.usage?.cacheCreationTokens).toBe(20);
    expect(res.usage?.promptTokens).toBe(130); // 10 + 100 + 20
    expect(res.usage?.completionTokens).toBe(5);
  });
});
