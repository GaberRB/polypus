import { z } from "zod";
import type { Tool } from "./types.js";
import { duckduckgoProvider } from "../net/search/duckduckgo.js";

const Args = z.object({
  query: z.string().min(1),
  max_results: z.coerce.number().int().min(1).max(10).optional(),
});

export const webSearchTool: Tool = {
  mutating: false,
  spec: {
    name: "web_search",
    description:
      "Search the web (keyless DuckDuckGo) and return a ranked list of title, URL and snippet. " +
      "Use it to find current information, then read a result with web_fetch. https-only; private/internal hosts are blocked.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        max_results: { type: "number", description: "How many results to return (1-10, default 5)" },
      },
      required: ["query"],
    },
  },
  async run(rawArgs, ctx) {
    const args = Args.safeParse(rawArgs);
    if (!args.success) return { ok: false, output: "Invalid args: 'query' is required (non-empty string)." };

    const max = args.data.max_results ?? 5;
    // Gate the provider request itself — consent + SSRF/https guard, even in bypass.
    const decision = await ctx.permissions.authorizeNetwork("https://html.duckduckgo.com/html/");
    if (!decision.allowed) return { ok: false, output: `Search denied: ${decision.reason}` };

    try {
      const results = await duckduckgoProvider.search(args.data.query, max);
      if (results.length === 0) return { ok: true, output: `No results for "${args.data.query}".` };
      const body = results
        .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}${r.snippet ? `\n   ${r.snippet}` : ""}`)
        .join("\n\n");
      return { ok: true, output: body };
    } catch (err) {
      return { ok: false, output: `Search failed: ${(err as Error).message}` };
    }
  },
};
