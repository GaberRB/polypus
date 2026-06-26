import { describe, expect, it } from "vitest";
import { askUserTool } from "../src/core/tools/ask-user.js";
import type { AskRequest } from "../src/core/tools/types.js";

const ctx = (ask?: (r: AskRequest) => Promise<string[] | null>) =>
  ({ workspace: ".", permissions: {} as never, ask });

describe("askUserTool", () => {
  it("returns the user's selection when an interactive prompt is available", async () => {
    const res = await askUserTool.run(
      { question: "Pick one", options: ["a", "b"] },
      ctx(async () => ["b"]),
    );
    expect(res.ok).toBe(true);
    expect(res.output).toContain("b");
  });

  it("supports multi-select", async () => {
    const res = await askUserTool.run(
      { question: "Pick some", options: ["a", "b", "c"], multi: true },
      ctx(async () => ["a", "c"]),
    );
    expect(res.ok).toBe(true);
    expect(res.output).toContain("a, c");
  });

  it("degrades gracefully in headless mode (no ask)", async () => {
    const res = await askUserTool.run({ question: "Q", options: ["a", "b"] }, ctx(undefined));
    expect(res.ok).toBe(false);
    expect(res.output).toMatch(/headless|default/i);
  });

  it("reports cancellation so the agent can fall back", async () => {
    const res = await askUserTool.run({ question: "Q", options: ["a", "b"] }, ctx(async () => null));
    expect(res.ok).toBe(false);
    expect(res.output).toMatch(/default/i);
  });

  it("rejects fewer than two options", async () => {
    const res = await askUserTool.run({ question: "Q", options: ["only"] }, ctx(async () => ["only"]));
    expect(res.ok).toBe(false);
  });
});
