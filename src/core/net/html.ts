/**
 * Dependency-free HTML helpers. Good enough to feed page text to a model without
 * pulling in cheerio/turndown; richer markdown conversion can be a later upgrade.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  copy: "©",
  reg: "®",
  trade: "™",
};

/** Decode the common named and numeric HTML entities. */
export function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => safeFromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeFromCodePoint(parseInt(d, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED_ENTITIES[name] ?? m);
}

function safeFromCodePoint(cp: number): string {
  try {
    return String.fromCodePoint(cp);
  } catch {
    return "";
  }
}

/** Remove all tags, returning their text content. */
export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ""));
}

/**
 * Convert an HTML document to readable plain text: drop script/style/head/nav/
 * svg, turn block boundaries into newlines, strip remaining tags, decode
 * entities, and collapse runaway whitespace.
 */
export function htmlToText(html: string): string {
  let s = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|head|nav|noscript|svg|iframe)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|section|article|header|footer|li|tr|h[1-6]|br)\s*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  s = decodeEntities(s.replace(/<[^>]*>/g, ""));
  return s
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
