import { describe, expect, it } from "vitest";
import { htmlToText, decodeEntities, stripTags } from "../src/core/net/html.js";
import { parseResults } from "../src/core/net/search/duckduckgo.js";

describe("htmlToText", () => {
  it("drops script/style and decodes entities", () => {
    const html =
      "<html><head><style>.x{color:red}</style></head><body>" +
      "<script>alert(1)</script><h1>Title</h1><p>Hello&nbsp;world &amp; more</p></body></html>";
    const text = htmlToText(html);
    expect(text).not.toMatch(/alert|color:red/);
    expect(text).toContain("Title");
    expect(text).toContain("Hello world & more");
  });

  it("decodes numeric entities", () => {
    expect(decodeEntities("A&#66;C &#x44;")).toBe("ABC D");
  });

  it("strips tags to text", () => {
    expect(stripTags("<b>bold</b> text")).toBe("bold text");
  });
});

describe("duckduckgo parseResults", () => {
  const html = `
    <div class="result">
      <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fa">First &amp; best</a>
      <a class="result__snippet">Snippet one</a>
    </div>
    <div class="result">
      <a class="result__a" href="https://example.org/b">Second</a>
      <a class="result__snippet">Snippet two</a>
    </div>`;

  it("extracts title, decoded URL and snippet", () => {
    const results = parseResults(html, 10);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ title: "First & best", url: "https://example.com/a", snippet: "Snippet one" });
    expect(results[1]!.url).toBe("https://example.org/b");
  });

  it("respects maxResults", () => {
    expect(parseResults(html, 1)).toHaveLength(1);
  });
});
