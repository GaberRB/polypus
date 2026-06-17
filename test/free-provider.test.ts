import { describe, expect, it } from "vitest";
import { withRetry } from "../src/core/agent/free-provider.js";

describe("withRetry", () => {
  it("retries on a transient 429 and then succeeds", async () => {
    let calls = 0;
    const out = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new Error("429 Provider returned error");
        return "ok";
      },
      { attempts: 4, baseMs: 1 },
    );
    expect(out).toBe("ok");
    expect(calls).toBe(3);
  });

  it("does not retry a non-transient error", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new Error("400 invalid model");
        },
        { attempts: 4, baseMs: 1 },
      ),
    ).rejects.toThrow(/invalid model/);
    expect(calls).toBe(1);
  });
});
