import { describe, expect, it, vi } from "vitest";

// Stub the provider registry so chatOnce never touches the network.
vi.mock("../src/core/providers/registry.js", () => ({
  createProvider: () => ({
    provider: {
      name: "fake",
      model: "m",
      chat: async (req: { messages: { content: string }[] }) => ({
        content: `echo:${req.messages.at(-1)?.content ?? ""}`,
        toolCalls: [],
        finishReason: "stop",
      }),
    },
  }),
}));

import { chatOnce } from "../src/core/agent/chat.js";
import type { AgentConfig } from "../src/core/config/schema.js";

const agent: AgentConfig = { name: "a", provider: "ollama", model: "m", toolMode: "auto" };

describe("chatOnce", () => {
  it("returns the provider's text for a plain chat (no tools)", async () => {
    const out = await chatOnce(agent, [{ role: "user", content: "oi" }]);
    expect(out).toBe("echo:oi");
  });
});
