import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { numericRef, stripBom, readProjectGuide } from "../src/cli/commands/cli-io.js";

describe("numericRef", () => {
  it("accepts a bare number and strips a leading #", () => {
    expect(numericRef("12")).toBe("12");
    expect(numericRef("#42")).toBe("42");
  });

  it("rejects non-numeric refs", () => {
    expect(() => numericRef("abc")).toThrow(/invalid|inválido/i);
    expect(() => numericRef("12x")).toThrow();
    expect(() => numericRef("")).toThrow();
  });
});

describe("stripBom", () => {
  it("removes a leading BOM and leaves clean text alone", () => {
    expect(stripBom("﻿{}")).toBe("{}");
    expect(stripBom("{}")).toBe("{}");
  });
});

describe("readProjectGuide", () => {
  const cwd = process.cwd();
  afterEach(() => process.chdir(cwd));

  it("concatenates existing guide files and skips missing ones", () => {
    const dir = mkdtempSync(join(tmpdir(), "polypus-guide-"));
    writeFileSync(join(dir, "context.md"), "project summary");
    process.chdir(dir);
    try {
      const guide = readProjectGuide(["context.md", "rules.md"]);
      expect(guide).toContain("# context.md");
      expect(guide).toContain("project summary");
      expect(guide).not.toContain("rules.md"); // missing → skipped
    } finally {
      process.chdir(cwd);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns undefined when no guide file exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "polypus-guide-"));
    process.chdir(dir);
    try {
      expect(readProjectGuide(["context.md", "rules.md"])).toBeUndefined();
    } finally {
      process.chdir(cwd);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
