import { describe, expect, it } from "vitest";
import { estimateTask } from "../src/core/agent/estimate.js";
import type { ResolvedAgent } from "../src/core/providers/registry.js";
import type { ChatResponse, Provider } from "../src/core/providers/types.js";

class JsonProvider implements Provider {
  readonly name = "json";
  readonly model = "json";
  constructor(private readonly content: string) {}
  async chat(): Promise<ChatResponse> {
    return { content: this.content, toolCalls: [], finishReason: "stop" };
  }
}

function agent(content: string): ResolvedAgent {
  return {
    config: { name: "t", provider: "openrouter", model: "m", toolMode: "native" },
    provider: new JsonProvider(content),
    toolMode: "native",
  };
}

describe("estimateTask", () => {
  it("parses the model JSON and computes cost from pricing", async () => {
    const json = '{"complexity":"high","estimatedSteps":60,"estimatedTokens":1000000,"rationale":"big","risks":"merge conflicts"}';
    const est = await estimateTask("implement MCP", agent(json), { promptPrice: 1, completionPrice: 2 });
    expect(est.complexity).toBe("high");
    expect(est.estimatedSteps).toBe(60);
    expect(est.estimatedTokens).toBe(1_000_000);
    // 0.8M*$1/1M + 0.2M*$2/1M = 0.8 + 0.4 = 1.2
    expect(est.costUsd).toBeCloseTo(1.2, 6);
    expect(est.costLabel).toBe("US$1.20");
  });

  it("tolerates prose around the JSON and clamps bad values", async () => {
    const est = await estimateTask(
      "x",
      agent('Sure! Here is my estimate:\n{"complexity":"weird","estimatedSteps":-5,"estimatedTokens":0}\nThanks'),
    );
    expect(est.complexity).toBe("medium"); // invalid → default
    expect(est.estimatedSteps).toBeGreaterThanOrEqual(1); // clamped
    expect(est.estimatedTokens).toBeGreaterThanOrEqual(1000); // clamped
    expect(est.costLabel).toMatch(/unknown/); // no pricing provided
  });

  it("falls back to defaults when there is no JSON at all", async () => {
    const est = await estimateTask("x", agent("I cannot estimate this."));
    expect(est.complexity).toBe("medium");
    expect(est.estimatedSteps).toBe(30);
    expect(est.estimatedTokens).toBe(80_000);
  });
});
