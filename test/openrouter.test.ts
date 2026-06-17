import { describe, expect, it } from "vitest";
import {
  filterModels,
  fmtContext,
  fmtPrice,
  type OpenRouterModel,
} from "../src/core/providers/openrouter.js";

const M = (over: Partial<OpenRouterModel>): OpenRouterModel => ({
  id: "x/y",
  name: "X Y",
  promptPrice: 1,
  completionPrice: 2,
  contextLength: 8000,
  supportsTools: true,
  free: false,
  ...over,
});

const models: OpenRouterModel[] = [
  M({ id: "a/cheap", promptPrice: 0.5, completionPrice: 1, supportsTools: true }),
  M({ id: "b/free", promptPrice: 0, completionPrice: 0, free: true, supportsTools: false }),
  M({ id: "c/pricey", promptPrice: 10, completionPrice: 30, supportsTools: true }),
  M({ id: "d/notools", promptPrice: 2, supportsTools: false }),
  M({ id: "e/auto", promptPrice: -1, supportsTools: true }),
];

describe("filterModels", () => {
  it("filters to tool-supporting models", () => {
    const out = filterModels(models, { tools: "tools" });
    expect(out.every((m) => m.supportsTools)).toBe(true);
    expect(out.map((m) => m.id)).not.toContain("b/free");
  });

  it("filters free only", () => {
    expect(filterModels(models, { freeOnly: true }).map((m) => m.id)).toEqual(["b/free"]);
  });

  it("respects maxPrice and excludes variable pricing", () => {
    const out = filterModels(models, { maxPrice: 1 }).map((m) => m.id);
    expect(out).toContain("a/cheap");
    expect(out).toContain("b/free");
    expect(out).not.toContain("c/pricey");
    expect(out).not.toContain("e/auto"); // variable price excluded
  });

  it("searches by id substring", () => {
    expect(filterModels(models, { search: "pricey" }).map((m) => m.id)).toEqual(["c/pricey"]);
  });

  it("sorts by price ascending with variable last", () => {
    const out = filterModels(models, { sort: "price" }).map((m) => m.id);
    expect(out[0]).toBe("b/free");
    expect(out[out.length - 1]).toBe("e/auto");
  });
});

describe("formatters", () => {
  it("formats prices", () => {
    expect(fmtPrice(0)).toBe("free");
    expect(fmtPrice(-1)).toBe("var");
    expect(fmtPrice(0.15)).toBe("$0.15");
    expect(fmtPrice(3)).toBe("$3");
    expect(fmtPrice(15)).toBe("$15");
  });
  it("formats context", () => {
    expect(fmtContext(200000)).toBe("200k");
    expect(fmtContext(1048576)).toBe("1M");
    expect(fmtContext(512)).toBe("512");
  });
});
