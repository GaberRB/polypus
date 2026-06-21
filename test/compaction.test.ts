import { describe, expect, it } from "vitest";
import { compactHistory, estimateTokens, findSafeCut } from "../src/core/agent/compaction.js";
import type { ResolvedAgent } from "../src/core/providers/registry.js";
import type { ChatResponse, Message, Provider } from "../src/core/providers/types.js";

class SummaryProvider implements Provider {
  readonly name = "summary";
  readonly model = "summary";
  calls = 0;
  async chat(): Promise<ChatResponse> {
    this.calls++;
    return { content: "SUMMARY", toolCalls: [], finishReason: "stop" };
  }
}

function agent(p: Provider): ResolvedAgent {
  return {
    config: { name: "t", provider: "ollama", model: "m", toolMode: "emulated" },
    provider: p,
    toolMode: "emulated",
  };
}

function msg(role: Message["role"], content: string, toolCalls?: Message["toolCalls"]): Message {
  return { role, content, ...(toolCalls ? { toolCalls } : {}) };
}

describe("estimateTokens", () => {
  it("approximates ~4 chars per token", () => {
    expect(estimateTokens([msg("user", "a".repeat(40))])).toBe(10);
  });
});

describe("findSafeCut", () => {
  it("does not start the kept tail on a tool result", () => {
    const messages: Message[] = [
      msg("system", "sys"),
      msg("user", "task"),
      msg("assistant", "", [{ id: "1", name: "read_file", arguments: {} }]),
      msg("tool", "file contents"),
      msg("assistant", "done"),
    ];
    const cut = findSafeCut(messages, 2); // wants to keep last 2 (tool + assistant)
    // cut must advance so messages[cut] is not the tool result nor right after a pending tool call
    expect(messages[cut]!.role).not.toBe("tool");
  });
});

describe("compactHistory", () => {
  it("replaces the old middle with a summary, keeping system + recent tail", async () => {
    const p = new SummaryProvider();
    const messages: Message[] = [msg("system", "sys")];
    for (let i = 0; i < 20; i++) {
      messages.push(msg("user", `u${i}`));
      messages.push(msg("assistant", `a${i}`));
    }
    const out = await compactHistory(messages, agent(p), undefined);
    expect(p.calls).toBe(1);
    expect(out[0]!.role).toBe("system");
    expect(out[1]!.content).toContain("SUMMARY");
    expect(out.length).toBeLessThan(messages.length);
    // the very last messages are preserved verbatim
    expect(out[out.length - 1]!.content).toBe("a19");
  });

  it("returns the original when there is too little to compact", async () => {
    const p = new SummaryProvider();
    const messages: Message[] = [msg("system", "sys"), msg("user", "task"), msg("assistant", "ok")];
    const out = await compactHistory(messages, agent(p), undefined);
    expect(p.calls).toBe(0);
    expect(out).toEqual(messages);
  });
});
