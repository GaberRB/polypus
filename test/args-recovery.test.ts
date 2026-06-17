import { describe, expect, it } from "vitest";
import { __test_safeParseArgs as safeParseArgs } from "../src/core/providers/openai-compatible.js";

describe("safeParseArgs (native tool args)", () => {
  it("parses valid JSON", () => {
    expect(safeParseArgs('{"path":"a.ts","content":"x"}')).toEqual({ path: "a.ts", content: "x" });
  });

  it("returns {} for empty arguments", () => {
    expect(safeParseArgs("")).toEqual({});
    expect(safeParseArgs("   ")).toEqual({});
  });

  it("recovers path/content from JSON with unescaped newlines", () => {
    // Invalid JSON: literal newline inside the content string.
    const raw = '{"path":"snake.html","content":"<!DOCTYPE html>\n<html></html>"}';
    const out = safeParseArgs(raw);
    expect(out.path).toBe("snake.html");
    expect(out.content).toBe("<!DOCTYPE html>\n<html></html>");
  });

  it("recovers content containing unescaped quotes (HTML attributes)", () => {
    const raw = '{"path":"a.html","content":"<div class="box">hi</div>"}';
    const out = safeParseArgs(raw);
    expect(out.path).toBe("a.html");
    expect(String(out.content)).toContain('class="box"');
  });
});
