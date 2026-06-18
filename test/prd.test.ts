import { describe, expect, it } from "vitest";
import { buildPrdPrompt, generatePrd } from "../src/core/agent/prd.js";
import type { ChatRequest, ChatResponse, Provider } from "../src/core/providers/types.js";

/** Provider that records the last request and replays a fixed response. */
class StubProvider implements Provider {
  readonly name = "stub";
  readonly model = "stub";
  last?: ChatRequest;
  constructor(private readonly content: string) {}
  async chat(req: ChatRequest): Promise<ChatResponse> {
    this.last = req;
    return { content: this.content, toolCalls: [], finishReason: "stop" };
  }
}

const issue = {
  number: 6,
  title: "Criar um modo Casual",
  body: "Quero que usuário casual use o polypus.",
  comments: [{ author: "alice", body: "cuidado com custo de tokens" }],
};

describe("buildPrdPrompt", () => {
  it("includes the issue title, body, comments and the required sections", () => {
    const prompt = buildPrdPrompt(issue);
    expect(prompt).toContain("Criar um modo Casual");
    expect(prompt).toContain("Quero que usuário casual");
    expect(prompt).toContain("cuidado com custo de tokens");
    expect(prompt).toContain("## Critérios de aceite");
    expect(prompt).toContain("## Riscos e alternativas");
  });
});

describe("generatePrd", () => {
  it("returns the model's markdown and sends a system + user message", async () => {
    const provider = new StubProvider("## Contexto\n...");
    const out = await generatePrd(issue, provider);

    expect(out).toBe("## Contexto\n...");
    expect(provider.last?.messages[0]?.role).toBe("system");
    expect(provider.last?.messages[1]?.content).toContain("Criar um modo Casual");
    expect(provider.last?.tools).toBeUndefined(); // single call, no tools
  });

  it("throws when the model returns an empty document", async () => {
    const provider = new StubProvider("   ");
    await expect(generatePrd(issue, provider)).rejects.toThrow(/empty/i);
  });

  it("injects the project context as an extra system message when provided", async () => {
    const provider = new StubProvider("## Contexto");
    await generatePrd(issue, provider, "POLYPUS is a coding harness.");
    const systems = provider.last?.messages.filter((m) => m.role === "system") ?? [];
    expect(systems.length).toBe(2);
    expect(systems.some((m) => m.content.includes("POLYPUS is a coding harness."))).toBe(true);
  });
});
