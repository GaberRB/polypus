import { describe, expect, it, vi } from "vitest";
import { CustomProvider } from "../src/core/providers/custom.js";
import type { CustomProviderConfig } from "../src/core/config/schema.js";

const baseConfig: CustomProviderConfig = {
  name: "TestProvider",
  auth: { type: "none" },
  chat: {
    url: "https://api.test.example/chat",
    method: "POST",
    headers: {},
    bodyTemplate: '{"prompt":"{{prompt}}"}',
  },
  responsePath: "$.reply",
  params: {},
  safetyMode: "review",
};

function mockFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

describe("CustomProvider", () => {
  it("extracts response via JSONPath", async () => {
    const fetch = mockFetch({ reply: "Olá!" });
    vi.stubGlobal("fetch", fetch);
    const provider = new CustomProvider(baseConfig);
    const res = await provider.chat({ messages: [{ role: "user", content: "Oi" }] });
    expect(res.content).toBe("Olá!");
    expect(res.toolCalls).toEqual([]);
    expect(res.finishReason).toBe("stop");
    vi.unstubAllGlobals();
  });

  it("substitutes {{prompt}} in body", async () => {
    const fetch = mockFetch({ reply: "ok" });
    vi.stubGlobal("fetch", fetch);
    const provider = new CustomProvider(baseConfig);
    await provider.chat({ messages: [{ role: "user", content: "test prompt" }] });
    const body = JSON.parse((fetch.mock.calls[0] as [string, RequestInit])[1].body as string) as {
      prompt: string;
    };
    expect(body.prompt).toBe("test prompt");
    vi.unstubAllGlobals();
  });

  it("substitutes {{params.x}} in URL", async () => {
    const fetch = mockFetch({ reply: "ok" });
    vi.stubGlobal("fetch", fetch);
    const cfg: CustomProviderConfig = {
      ...baseConfig,
      chat: { ...baseConfig.chat, url: "https://api.test.example/{{params.agent_id}}/chat" },
      params: { agent_id: "abc123" },
    };
    const provider = new CustomProvider(cfg);
    await provider.chat({ messages: [{ role: "user", content: "hi" }] });
    const url = (fetch.mock.calls[0] as [string, RequestInit])[0];
    expect(url).toBe("https://api.test.example/abc123/chat");
    vi.unstubAllGlobals();
  });

  it("throws when response JSONPath misses", async () => {
    vi.stubGlobal("fetch", mockFetch({ other: "field" }));
    const provider = new CustomProvider(baseConfig);
    await expect(
      provider.chat({ messages: [{ role: "user", content: "x" }] }),
    ).rejects.toThrow(/not found at path/);
    vi.unstubAllGlobals();
  });

  it("throws on non-2xx response", async () => {
    vi.stubGlobal("fetch", mockFetch({ error: "unauthorized" }, 401));
    const provider = new CustomProvider(baseConfig);
    await expect(
      provider.chat({ messages: [{ role: "user", content: "x" }] }),
    ).rejects.toThrow(/401/);
    vi.unstubAllGlobals();
  });

  it("injects api-key in header", async () => {
    const fetch = mockFetch({ reply: "ok" });
    vi.stubGlobal("fetch", fetch);
    const cfg: CustomProviderConfig = {
      ...baseConfig,
      auth: { type: "api-key", headerName: "X-Api-Key", apiKey: "mykey" },
    };
    const provider = new CustomProvider(cfg);
    await provider.chat({ messages: [{ role: "user", content: "hi" }] });
    const headers = (fetch.mock.calls[0] as [string, RequestInit])[1].headers as Record<
      string,
      string
    >;
    expect(headers["X-Api-Key"]).toBe("mykey");
    vi.unstubAllGlobals();
  });
});
