import { describe, expect, it } from "vitest";
import {
  recommendConcurrency,
  OLLAMA_ENDPOINT_CONCURRENCY,
} from "../src/core/agent/concurrency.js";
import type { ResolvedAgent } from "../src/core/providers/registry.js";

function agent(provider: string, baseUrl?: string): ResolvedAgent {
  return {
    config: { name: `${provider}-${baseUrl ?? "d"}`, provider, baseUrl, model: "m", toolMode: "auto" },
    toolMode: "native",
  } as unknown as ResolvedAgent;
}

describe("recommendConcurrency", () => {
  it("caps several ollama agents on one endpoint", () => {
    const agents = Array.from({ length: 5 }, () => agent("ollama", "http://localhost:11434/v1"));
    expect(recommendConcurrency(agents)).toBe(OLLAMA_ENDPOINT_CONCURRENCY);
  });

  it("lets hosted agents run fully in parallel", () => {
    const agents = Array.from({ length: 4 }, (_, i) => agent("openrouter", `https://or/${i}`));
    expect(recommendConcurrency(agents)).toBe(4);
  });

  it("sums capacities across distinct endpoints", () => {
    const agents = [
      agent("ollama", "http://localhost:11434/v1"),
      agent("ollama", "http://localhost:11434/v1"),
      agent("openrouter", "https://openrouter.ai/api/v1"),
    ];
    // min(2, OLLAMA_CAP) + 1 hosted
    expect(recommendConcurrency(agents)).toBe(Math.min(2, OLLAMA_ENDPOINT_CONCURRENCY) + 1);
  });

  it("counts separate ollama endpoints independently", () => {
    const agents = [
      agent("ollama", "http://localhost:11434/v1"),
      agent("ollama", "http://other:11434/v1"),
    ];
    expect(recommendConcurrency(agents)).toBe(2);
  });

  it("never returns less than 1", () => {
    expect(recommendConcurrency([])).toBe(1);
  });
});
