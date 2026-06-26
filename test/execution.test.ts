import { describe, expect, it } from "vitest";
import { ExecutionConfig, resolveExecution } from "../src/core/config/schema.js";
import { extractKeywords } from "../src/core/context/keyword.js";
import { updatePlanTool } from "../src/core/tools/update-plan.js";

const parse = (raw: unknown) => ExecutionConfig.parse(raw);

describe("resolveExecution", () => {
  it("quality profile turns the scaffolding on by default", () => {
    const r = resolveExecution(parse({}));
    expect(r).toMatchObject({ profile: "quality", verify: true, planFirst: true, autoContext: true });
  });

  it("fast profile turns the scaffolding off", () => {
    const r = resolveExecution(parse({ profile: "fast" }));
    expect(r).toMatchObject({ profile: "fast", verify: false, planFirst: false, autoContext: false });
  });

  it("a config field overrides the profile preset", () => {
    // fast profile, but verify explicitly forced on in config
    const r = resolveExecution(parse({ profile: "fast", verify: true }));
    expect(r.verify).toBe(true);
    expect(r.planFirst).toBe(false);
  });

  it("a CLI override beats both config and profile", () => {
    const r = resolveExecution(parse({ profile: "quality", verify: true }), { verify: false });
    expect(r.verify).toBe(false);
  });

  it("a CLI profile override selects the preset", () => {
    const r = resolveExecution(parse({ profile: "quality" }), { profile: "fast" });
    expect(r.verify).toBe(false);
    expect(r.planFirst).toBe(false);
  });
});

describe("extractKeywords", () => {
  it("drops stopwords and short tokens, keeps meaningful identifiers", () => {
    const kw = extractKeywords("add a retry to the OpenRouter provider in src/handlers");
    expect(kw).toContain("OpenRouter");
    expect(kw).toContain("provider");
    expect(kw).toContain("handlers");
    expect(kw).not.toContain("add");
    expect(kw).not.toContain("the");
    // case-insensitive dedupe: the lowercase form is not a separate entry
    expect(kw).not.toContain("openrouter");
  });

  it("dedupes case-insensitively and caps the count", () => {
    const kw = extractKeywords("token token token alpha beta gamma delta epsilon zeta eta theta iota kappa", 5);
    expect(kw.length).toBeLessThanOrEqual(5);
  });
});

describe("updatePlanTool", () => {
  it("renders a numbered checklist with status markers", async () => {
    const res = await updatePlanTool.run({
      steps: [
        { step: "read the file", status: "done" },
        { step: "edit the function", status: "in_progress" },
        "run the tests",
      ],
    }, {} as never);
    expect(res.ok).toBe(true);
    expect(res.output).toContain("1. [x] read the file");
    expect(res.output).toContain("2. [~] edit the function");
    expect(res.output).toContain("3. [ ] run the tests");
  });

  it("rejects empty input", async () => {
    const res = await updatePlanTool.run({ steps: [] }, {} as never);
    expect(res.ok).toBe(false);
  });
});
