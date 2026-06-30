/**
 * Ferramentas web (navegador) — registradas no core do Polypus.
 *
 * Estas ferramentas são **pontes**: quando chamadas pelo agente, emitem
 * eventos para a extensão Chrome (via WebSocket) que as executa no navegador.
 * Em modo headless (sem extensão), têm fallback limitado de leitura via fetch.
 *
 * Tools registradas:
 *   web_navigate, web_extract, web_scroll, web_screenshot,
 *   web_get_html, web_wait, web_click, web_type, web_execute
 */
import { z } from "zod";
import type { Tool, ToolResult, ToolContext } from "./types.js";

/* ─── Schemas de parâmetros ─── */

const NavigateArgs = z.object({ url: z.string().min(1) });
const ExtractArgs = z.object({ selector: z.string().optional() });
const ScrollArgs = z.object({ direction: z.enum(["up", "down", "top", "bottom"]) });
const WaitArgs = z.object({ ms: z.coerce.number().int().min(0).max(120_000).default(500) });
const ClickArgs = z.object({ selector: z.string().min(1) });
const TypeArgs = z.object({ selector: z.string().min(1), text: z.string() });
const ExecuteArgs = z.object({ code: z.string().min(1) });
const ScreenshotArgs = z.object({});
const GetHtmlArgs = z.object({});

/* ─── Ferramentas ─── */

export const webNavigateTool: Tool = {
  mutating: false,
  spec: {
    name: "web_navigate",
    description:
      "Navigate the browser tab to a URL. Use this to go to a specific page the agent needs to interact with. " +
      "Only https/http URLs are allowed.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to navigate to (must be http or https)" },
      },
      required: ["url"],
    },
  },
  async run(rawArgs: unknown, ctx: ToolContext): Promise<ToolResult> {
    const args = NavigateArgs.safeParse(rawArgs);
    if (!args.success) return { ok: false, output: "Invalid args: 'url' is required (string)." };
    const { url } = args.data;
    if (!/^https?:\/\//i.test(url)) return { ok: false, output: `Invalid URL: "${url}" — must start with http:// or https://` };

    const decision = await ctx.permissions.authorizeNetwork(url);
    if (!decision.allowed) return { ok: false, output: `Navigate denied: ${decision.reason}` };

    // Em modo headless (sem extensão), fallback para fetch
    try {
      const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(10000) });
      if (!res.ok) return { ok: false, output: `Navigate failed: HTTP ${res.status} for ${url}` };
      return { ok: true, output: `✓ Navigated to ${url} (${res.status})` };
    } catch (err) {
      return { ok: false, output: `Navigate failed: ${(err as Error).message}` };
    }
  },
};

export const webExtractTool: Tool = {
  mutating: false,
  spec: {
    name: "web_extract",
    description:
      "Extract text content from the current page. If a CSS selector is provided, extracts from that element only. " +
      "If omitted, extracts the whole page body text.",
    parameters: {
      type: "object",
      properties: {
        selector: { type: "string", description: "Optional CSS selector to extract a specific element" },
      },
    },
  },
  async run(rawArgs: unknown, _ctx: ToolContext): Promise<ToolResult> {
    const args = ExtractArgs.safeParse(rawArgs);
    if (!args.success) return { ok: false, output: "Invalid args." };
    // Headless fallback: sem navegador, não há página para extrair
    return { ok: false, output: "web_extract requires the browser extension to be connected. Start `polypus web-server` and connect the Chrome extension." };
  },
};

export const webScrollTool: Tool = {
  mutating: false,
  spec: {
    name: "web_scroll",
    description: "Scroll the browser page in the given direction: up, down, top, or bottom.",
    parameters: {
      type: "object",
      properties: {
        direction: { type: "string", enum: ["up", "down", "top", "bottom"], description: "Scroll direction" },
      },
      required: ["direction"],
    },
  },
  async run(rawArgs: unknown, _ctx: ToolContext): Promise<ToolResult> {
    const args = ScrollArgs.safeParse(rawArgs);
    if (!args.success) return { ok: false, output: "Invalid args: 'direction' is required (up|down|top|bottom)." };
    return { ok: false, output: "web_scroll requires the browser extension to be connected." };
  },
};

export const webScreenshotTool: Tool = {
  mutating: false,
  spec: {
    name: "web_screenshot",
    description:
      "Capture a screenshot of the current browser viewport as a JPEG data URL. " +
      "Useful for models with vision capabilities to 'see' the page.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  async run(_rawArgs: unknown, _ctx: ToolContext): Promise<ToolResult> {
    return { ok: false, output: "web_screenshot requires the browser extension to be connected." };
  },
};

export const webGetHtmlTool: Tool = {
  mutating: false,
  spec: {
    name: "web_get_html",
    description: "Get the full HTML of the current page as a string. Useful for analyzing page structure.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  async run(_rawArgs: unknown, _ctx: ToolContext): Promise<ToolResult> {
    return { ok: false, output: "web_get_html requires the browser extension to be connected." };
  },
};

export const webWaitTool: Tool = {
  mutating: false,
  spec: {
    name: "web_wait",
    description: "Wait for a given number of milliseconds. Use it to let the page load or animations finish.",
    parameters: {
      type: "object",
      properties: {
        ms: { type: "number", description: "Milliseconds to wait (0-120000, default 500)" },
      },
    },
  },
  async run(rawArgs: unknown, _ctx: ToolContext): Promise<ToolResult> {
    const args = WaitArgs.safeParse(rawArgs);
    if (!args.success) return { ok: false, output: "Invalid args: 'ms' must be a number 0-120000." };
    await new Promise((r) => setTimeout(r, args.data.ms));
    return { ok: true, output: `✓ Waited ${args.data.ms}ms` };
  },
};

export const webClickTool: Tool = {
  mutating: true,
  spec: {
    name: "web_click",
    description: "Click on an element in the page matching the given CSS selector.",
    parameters: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector for the element to click" },
      },
      required: ["selector"],
    },
  },
  async run(rawArgs: unknown, _ctx: ToolContext): Promise<ToolResult> {
    const args = ClickArgs.safeParse(rawArgs);
    if (!args.success) return { ok: false, output: "Invalid args: 'selector' is required (CSS selector)." };
    return { ok: false, output: "web_click requires the browser extension to be connected." };
  },
};

export const webTypeTool: Tool = {
  mutating: true,
  spec: {
    name: "web_type",
    description: "Type text into an input field matching the given CSS selector.",
    parameters: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector for the input element" },
        text: { type: "string", description: "Text to type into the input" },
      },
      required: ["selector", "text"],
    },
  },
  async run(rawArgs: unknown, _ctx: ToolContext): Promise<ToolResult> {
    const args = TypeArgs.safeParse(rawArgs);
    if (!args.success) return { ok: false, output: "Invalid args: 'selector' and 'text' are required." };
    return { ok: false, output: "web_type requires the browser extension to be connected." };
  },
};

export const webExecuteTool: Tool = {
  mutating: true,
  spec: {
    name: "web_execute",
    description:
      "Execute arbitrary JavaScript in the browser page context. " +
      "⚠️ Only available in bypass mode for security reasons.",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string", description: "JavaScript code to execute" },
      },
      required: ["code"],
    },
  },
  async run(rawArgs: unknown, _ctx: ToolContext): Promise<ToolResult> {
    const args = ExecuteArgs.safeParse(rawArgs);
    if (!args.success) return { ok: false, output: "Invalid args: 'code' is required (JavaScript string)." };
    return { ok: false, output: "web_execute requires the browser extension to be connected." };
  },
};

/* ─── Lista completa ─── */

export const WEB_TOOLS = [
  webNavigateTool,
  webExtractTool,
  webScrollTool,
  webScreenshotTool,
  webGetHtmlTool,
  webWaitTool,
  webClickTool,
  webTypeTool,
  webExecuteTool,
];