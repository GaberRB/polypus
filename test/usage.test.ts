import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  aggregateUsage,
  aggregateUsageByModel,
  estimateCost,
  fmtUsd,
  projectUsagePath,
  recordUsage,
} from "../src/core/agent/usage.js";

describe("estimateCost", () => {
  it("computes USD from per-million pricing", () => {
    const cost = estimateCost(
      { promptTokens: 1_000_000, completionTokens: 500_000 },
      { promptPrice: 3, completionPrice: 6 },
    );
    expect(cost).toBeCloseTo(3 + 3, 6); // 1M*$3 + 0.5M*$6
  });
});

describe("estimateCost with cache", () => {
  it("re-prices cached reads at 0.1x and writes at 1.25x", () => {
    // 1M total input = 200k full-rate + 600k cache read + 200k cache write.
    const cost = estimateCost(
      { promptTokens: 1_000_000, completionTokens: 0, cacheReadTokens: 600_000, cacheCreationTokens: 200_000 },
      { promptPrice: 10, completionPrice: 20 },
    );
    // 0.2*10 + 0.2*10*1.25 + 0.6*10*0.1 = 2 + 2.5 + 0.6 = 5.1
    expect(cost).toBeCloseTo(5.1, 6);
  });

  it("is unchanged from the old formula when no cache fields are present", () => {
    const cost = estimateCost(
      { promptTokens: 1_000_000, completionTokens: 500_000 },
      { promptPrice: 3, completionPrice: 6 },
    );
    expect(cost).toBeCloseTo(6, 6); // 1M*$3 + 0.5M*$6
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

  it("aggregates by model, ordered by cost then tokens, with a grand total", async () => {
    const base = { ts: "2026-06-20T10:00:00.000Z", agent: "a", provider: "openrouter" };
    await recordUsage({ ...base, model: "cheap", promptTokens: 1000, completionTokens: 0, costUsd: 0.001 });
    await recordUsage({ ...base, model: "pricey", promptTokens: 100, completionTokens: 100, costUsd: 0.5 });
    await recordUsage({ ...base, model: "pricey", promptTokens: 50, completionTokens: 50, costUsd: 0.25 });

    const { models, total } = await aggregateUsageByModel();
    expect(models.map((m) => m.model)).toEqual(["pricey", "cheap"]); // cost desc
    const pricey = models[0]!;
    expect(pricey.runs).toBe(2);
    expect(pricey.promptTokens + pricey.completionTokens).toBe(300);
    expect(pricey.costUsd).toBeCloseTo(0.75, 6);
    expect(total.runs).toBe(3);
    expect(total.costUsd).toBeCloseTo(0.751, 6);
  });

  it("also writes a per-project log when a workspace is given", async () => {
    const workspace = mkdtempSync(join(tmpdir(), "polypus-ws-"));
    try {
      await recordUsage(
        { ts: "2026-06-20T10:00:00.000Z", agent: "a", provider: "openrouter", model: "m", promptTokens: 10, completionTokens: 5, costUsd: 0.01 },
        { workspace },
      );
      const line = readFileSync(projectUsagePath(workspace), "utf8").trim();
      expect(JSON.parse(line).model).toBe("m");

      const { total } = await aggregateUsageByModel(projectUsagePath(workspace));
      expect(total.runs).toBe(1);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});
