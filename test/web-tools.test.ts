import { describe, expect, it } from "vitest";
import { PermissionEngine } from "../src/core/permissions/modes.js";
import type { ToolContext } from "../src/core/tools/types.js";
import { webFetchTool } from "../src/core/tools/web-fetch.js";
import { webSearchTool } from "../src/core/tools/web-search.js";
import { downloadTool } from "../src/core/tools/download.js";

function ctx(mode: "plan" | "review" | "bypass"): ToolContext {
  return {
    workspace: "/ws",
    permissions: new PermissionEngine({
      mode,
      policy: { workspace: "/ws", allow: ["**/*"], deny: [] },
      allowedCommands: [],
      confirm: async () => false,
    }),
  };
}

describe("web_fetch tool", () => {
  it("rejects non-https URLs before any request", async () => {
    const r = await webFetchTool.run({ url: "http://example.com" }, ctx("bypass"));
    expect(r.ok).toBe(false);
    expect(r.output).toMatch(/denied|blocked|https/i);
  });

  it("rejects private/SSRF targets even in bypass", async () => {
    const r = await webFetchTool.run({ url: "https://169.254.169.254/" }, ctx("bypass"));
    expect(r.ok).toBe(false);
  });

  it("is disabled in plan mode", async () => {
    const r = await webFetchTool.run({ url: "https://example.com" }, ctx("plan"));
    expect(r.ok).toBe(false);
    expect(r.output).toMatch(/plan mode/i);
  });

  it("validates args", async () => {
    const r = await webFetchTool.run({}, ctx("bypass"));
    expect(r.ok).toBe(false);
  });
});

describe("web_search tool", () => {
  it("is disabled in plan mode", async () => {
    const r = await webSearchTool.run({ query: "test" }, ctx("plan"));
    expect(r.ok).toBe(false);
  });

  it("validates args", async () => {
    const r = await webSearchTool.run({}, ctx("bypass"));
    expect(r.ok).toBe(false);
  });
});

describe("download tool", () => {
  it("rejects a destination that escapes the workspace", async () => {
    const r = await downloadTool.run({ url: "https://example.com/f.bin", dest_path: "../escape.bin" }, ctx("bypass"));
    expect(r.ok).toBe(false);
    expect(r.output).toMatch(/escape|denied/i);
  });

  it("rejects a private/SSRF source before writing", async () => {
    const r = await downloadTool.run({ url: "https://127.0.0.1/f.bin", dest_path: "f.bin" }, ctx("bypass"));
    expect(r.ok).toBe(false);
  });

  it("is disabled in plan mode", async () => {
    const r = await downloadTool.run({ url: "https://example.com/f.bin", dest_path: "f.bin" }, ctx("plan"));
    expect(r.ok).toBe(false);
  });
});
