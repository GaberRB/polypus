import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../src/ui/markdown.js";

// Colors are environment-dependent (picocolors may or may not emit ANSI), so we
// strip escape codes and assert the deterministic structural transforms:
// markers stripped, bullets/headings normalized.
const ANSI = new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g");
const md = (s: string): string => renderMarkdown(s).replace(ANSI, "");

describe("renderMarkdown", () => {
  it("strips bold and italic markers", () => {
    expect(md("this is **bold** and *italic* text")).toBe("this is bold and italic text");
    expect(md("also __bold__ and _italic_")).toBe("also bold and italic");
  });

  it("strips inline code backticks", () => {
    expect(md("call `npm run build` now")).toBe("call npm run build now");
  });

  it("converts bullets to a dot glyph", () => {
    expect(md("- first\n- second")).toBe("• first\n• second");
    expect(md("* star bullet")).toBe("• star bullet");
  });

  it("keeps numbered lists but styles the marker", () => {
    expect(md("1. one\n2. two")).toBe("1. one\n2. two");
  });

  it("drops heading hashes", () => {
    expect(md("# Title")).toBe("Title");
    expect(md("### Sub")).toBe("Sub");
  });

  it("removes code fences and keeps the code lines", () => {
    const out = md("before\n```ts\nconst x = 1;\n```\nafter");
    expect(out).not.toContain("```");
    expect(out).toContain("const x = 1;");
    expect(out).toContain("before");
    expect(out).toContain("after");
  });

  it("does not treat underscores inside words as italic", () => {
    expect(md("my_var and file_name")).toBe("my_var and file_name");
  });
});
