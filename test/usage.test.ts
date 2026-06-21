import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aggregateUsage, estimateCost, fmtUsd, recordUsage } from "../src/core/agent/usage.js";

describe("estimateCost", () => {
  it("computes USD from per-million pricing", () => {
    const cost = estimateCost(
      { promptTokens: 1_000_000, completionTokens: 500_000 },
      { promptPrice: 3, completionPrice: 6 },
    );
    expect(cost).toBeCloseTo(3 + 3, 6); // 1M*$3 + 0.5M*$6
  });
});

describe("fmtUsd", () => {
  it("uses extra precision for sub-cent amounts", () => {
    expect(fmtUsd(0)).toBe("US$0.00");
    expect(fmtUsd(0.0004)).toBe("US$0.0004");
    expect(fmtUsd(1.2)).toBe("US$1.20");
  });
});

describe("recordUsage + aggregateUsage", () => {
  let home: string;
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "polypus-usage-"));
    process.env.POLYPUS_HOME = home;
  });
  afterEach(() => {
    delete process.env.POLYPUS_HOME;
    try {
      rmSync(home, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("aggregates recorded usage by day with a grand total", async () => {
    await recordUsage({
      ts: "2026-06-20T10:00:00.000Z",
      agent: "a",
      provider: "openrouter",
      model: "m",
      promptTokens: 100,
      completionTokens: 50,
      costUsd: 0.01,
    });
    await recordUsage({
      ts: "2026-06-21T10:00:00.000Z",
      agent: "a",
      provider: "openrouter",
      model: "m",
      promptTokens: 200,
      completionTokens: 100,
      costUsd: 0.02,
    });

    const { days, total } = await aggregateUsage();
    expect(days.map((d) => d.date)).toEqual(["2026-06-20", "2026-06-21"]);
    expect(total.promptTokens).toBe(300);
    expect(total.completionTokens).toBe(150);
    expect(total.costUsd).toBeCloseTo(0.03, 6);
    expect(total.runs).toBe(2);
  });

  it("returns empty when nothing has been recorded", async () => {
    const { days, total } = await aggregateUsage();
    expect(days).toEqual([]);
    expect(total.runs).toBe(0);
  });
});
