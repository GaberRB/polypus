import { describe, expect, it } from "vitest";
import { numericRef, stripBom } from "../src/cli/commands/cli-io.js";

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
