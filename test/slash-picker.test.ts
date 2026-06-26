import { describe, expect, it } from "vitest";
import { matchesCmd, slashItems } from "../src/ui/slash-picker.js";
import { setLocale } from "../src/core/i18n/index.js";

describe("slashItems", () => {
  it("parses the localized list into clean command items", () => {
    setLocale("en");
    const items = slashItems();
    const names = items.map((i) => i.cmd);

    // The five commands added to the REPL must be present.
    for (const cmd of ["usage", "models", "estimate", "index", "retrieve"]) {
      expect(names).toContain(cmd);
    }
    // Bare command never carries the slash or arg placeholder, and has a hint.
    for (const it of items) {
      expect(it.cmd).not.toMatch(/[/\s<>]/);
      expect(it.label.startsWith("/")).toBe(true);
      expect(it.hint.length).toBeGreaterThan(0);
    }
  });
});

describe("matchesCmd", () => {
  it("matches by case-insensitive subsequence and empty query", () => {
    expect(matchesCmd("usage", "")).toBe(true);
    expect(matchesCmd("usage", "usg")).toBe(true); // subsequence
    expect(matchesCmd("usage", "USA")).toBe(true); // case-insensitive
    expect(matchesCmd("usage", "x")).toBe(false);
    expect(matchesCmd("estimate", "est")).toBe(true);
  });
});
