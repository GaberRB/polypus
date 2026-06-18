import { describe, expect, it } from "vitest";
import { runSwarmSession } from "../src/cli/commands/swarm.js";
import { PolypusConfig } from "../src/core/config/schema.js";

/** A config with `n` Ollama agents (no network needed; the gate runs first). */
function cfg(n: number) {
  return PolypusConfig.parse({
    agents: Array.from({ length: n }, (_, i) => ({ name: `a${i}`, provider: "ollama", model: "m" })),
  });
}

describe("runSwarmSession gate", () => {
  it("rejects with fewer than 3 configured agents", async () => {
    await expect(runSwarmSession("do something", cfg(2))).rejects.toThrow(/3/);
  });

  it("rejects with zero agents", async () => {
    await expect(runSwarmSession("do something", cfg(0))).rejects.toThrow();
  });
});
