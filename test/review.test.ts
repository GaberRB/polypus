import { describe, expect, it } from "vitest";
import { buildReviewPrompt, clampDiff, reviewDiff, MAX_DIFF_CHARS } from "../src/core/agent/review.js";
import type { ChatRequest, ChatResponse, Provider } from "../src/core/providers/types.js";

class StubProvider implements Provider {
  readonly name = "stub";
  readonly model = "stub";
  last?: ChatRequest;
  calls = 0;
  constructor(private readonly content: string) {}
  async chat(req: ChatRequest): Promise<ChatResponse> {
    this.calls++;
    this.last = req;
    return { content: this.content, toolCalls: [], finishReason: "stop" };
  }
}

const meta = { number: 8, title: "feat: x", body: "faz x" };
const diff = "diff --git a/x.ts b/x.ts\n+const a = 1;\n";

describe("clampDiff", () => {
  it("leaves a small diff untouched", () => {
    expect(clampDiff(diff)).toBe(diff);
  });
  it("truncates an oversized diff with a marker", () => {
    const big = "x".repeat(MAX_DIFF_CHARS + 500);
    const out = clampDiff(big);
    expect(out.length).toBeLessThan(big.length);
    expect(out).toContain("diff truncado");
  });
});

describe("buildReviewPrompt", () => {
  it("includes the PR title, body and the diff", () => {
    const prompt = buildReviewPrompt(diff, meta);
    expect(prompt).toContain("feat: x");
    expect(prompt).toContain("faz x");
    expect(prompt).toContain("const a = 1;");
  });
});

describe("reviewDiff", () => {
  it("returns the model's markdown for a real diff", async () => {
    const provider = new StubProvider("🔴 bug em x.ts");
    const out = await reviewDiff(diff, meta, provider);
    expect(out).toBe("🔴 bug em x.ts");
    expect(provider.last?.tools).toBeUndefined();
  });

  it("short-circuits an empty diff without calling the model", async () => {
    const provider = new StubProvider("should not be used");
    const out = await reviewDiff("   ", meta, provider);
    expect(provider.calls).toBe(0);
    expect(out).toMatch(/sem altera/i);
  });

  it("injects the project guide as an extra system message when provided", async () => {
    const provider = new StubProvider("ok");
    await reviewDiff(diff, meta, provider, "Rule: no telemetry.");
    const systems = provider.last?.messages.filter((m) => m.role === "system") ?? [];
    expect(systems.length).toBe(2);
    expect(systems.some((m) => m.content.includes("no telemetry"))).toBe(true);
  });
});
