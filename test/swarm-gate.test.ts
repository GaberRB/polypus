import { describe, expect, it } from "vitest";
import { canSwarm, MIN_SWARM_AGENTS } from "../src/cli/commands/swarm.js";

describe("canSwarm", () => {
  it("requires at least MIN_SWARM_AGENTS agents", () => {
    expect(MIN_SWARM_AGENTS).toBe(1);
    expect(canSwarm(0)).toBe(false);
    expect(canSwarm(1)).toBe(true);
    expect(canSwarm(2)).toBe(true);
    expect(canSwarm(3)).toBe(true);
    expect(canSwarm(5)).toBe(true);
  });
});
