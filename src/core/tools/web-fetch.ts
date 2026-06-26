import { z } from "zod";
import type { Tool } from "./types.js";
import { safeFetch } from "../net/safe-fetch.js";
import { htmlToText } from "../net/html.js";

const Args = z.object({
  url: z.string().min(1),
  max_chars: z.coerce.number().int().min(500).max(200_000).optional(),
});
const DEFAULT_MAX_CHARS = 60_000;

export const webFetchTool: Tool = {
  mutating: false,
  spec: {
    name: "web_fetch",
    description:
      "Fetch an https URL and return its readable text (HTML is stripped to plain text; JSON/text returned as-is). " +
      "Use after web_search to read a page. https-only; private/internal hosts and oversized responses are blocked.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Absolute https URL to fetch" },
        max_chars: { type: "number", description: "Truncate output to this many characters (default 60000)" },
      },
      required: ["url"],
    },
  },
  async run(rawArgs, ctx) {
    const args = Args.safeParse(rawArgs);
    if (!args.success) return { ok: false, output: "Invalid args: 'url' is required (absolute https URL)." };

    const decision = await ctx.permissions.authorizeNetwork(args.data.url);
    if (!decision.allowed) return { ok: false, output: `Fetch denied: ${decision.reason}` };

    try {
      const res = await safeFetch(args.data.url);
      if (res.status >= 400) return { ok: false, output: `Fetch failed: HTTP ${res.status} for ${res.url}` };

      const ct = res.contentType.toLowerCase();
      const isText = /text\/|application\/(json|xml|.*\+json|.*\+xml)|javascript/.test(ct) || ct === "";
      if (!isText) {
        return {
          ok: false,
          output: `Refused: content-type "${res.contentType}" is not text. Use the download tool to save binary files.`,
        };
      }

      const raw = res.body.toString("utf8");
      const text = /text\/html/.test(ct) ? htmlToText(raw) : raw.trim();
      const limit = args.data.max_chars ?? DEFAULT_MAX_CHARS;
      const output = text.length > limit ? text.slice(0, limit) + "\n…[truncated]" : text;
      return { ok: true, output: output || "(empty response)" };
    } catch (err) {
      return { ok: false, output: `Fetch failed: ${(err as Error).message}` };
    }
  },
};
