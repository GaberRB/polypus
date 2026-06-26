/**
 * DuckDuckGo search provider — keyless. Hits the no-JS HTML endpoint and scrapes
 * the result list. No API key or config required, at the cost of being tied to
 * DuckDuckGo's markup. The `SearchProvider` shape keeps a keyed provider (Brave/
 * Tavily) addable later without touching the tool.
 */
import { safeFetch } from "../safe-fetch.js";
import { stripTags } from "../html.js";
import type { UrlPolicy } from "../../permissions/policy.js";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchProvider {
  readonly name: string;
  search(query: string, maxResults: number, opts?: { policy?: UrlPolicy; signal?: AbortSignal }): Promise<SearchResult[]>;
}

const ENDPOINT = "https://html.duckduckgo.com/html/";

export const duckduckgoProvider: SearchProvider = {
  name: "duckduckgo",
  async search(query, maxResults, opts) {
    const url = `${ENDPOINT}?q=${encodeURIComponent(query)}`;
    const res = await safeFetch(url, {
      timeoutMs: 12_000,
      maxBytes: 2 * 1024 * 1024,
      policy: opts?.policy,
      signal: opts?.signal,
    });
    if (res.status !== 200) {
      throw new Error(`search provider returned HTTP ${res.status}`);
    }
    return parseResults(res.body.toString("utf8"), maxResults);
  },
};

/** Extract result rows from the DuckDuckGo HTML page. */
export function parseResults(html: string, maxResults: number): SearchResult[] {
  const results: SearchResult[] = [];
  const linkRe = /<a[^>]+class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRe = /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;

  const snippets: string[] = [];
  let sm: RegExpExecArray | null;
  while ((sm = snippetRe.exec(html))) snippets.push(stripTags(sm[1]!).trim());

  let lm: RegExpExecArray | null;
  let i = 0;
  while ((lm = linkRe.exec(html)) && results.length < maxResults) {
    const href = decodeHref(lm[1]!);
    const title = stripTags(lm[2]!).trim();
    if (!href || !title) {
      i++;
      continue;
    }
    results.push({ title, url: href, snippet: snippets[i] ?? "" });
    i++;
  }
  return results;
}

/** DuckDuckGo wraps result links as /l/?uddg=<encoded-target>; unwrap to the real URL. */
function decodeHref(href: string): string {
  try {
    const u = new URL(href, "https://duckduckgo.com");
    const target = u.searchParams.get("uddg");
    if (target) return target;
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : "";
  } catch {
    return "";
  }
}
