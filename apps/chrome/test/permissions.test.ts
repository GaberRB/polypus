/**
 * Tests for shared permission engine.
 *
 * Covers:
 *   - isUrlAllowed(url, perms) — allow, block, empty list, glob patterns
 *   - isActionAllowed(action, mode) — what flies in plan/review/bypass
 *   - actionLabelKey(action) — i18n key mapping
 *   - defaultPermissions() — correct defaults
 */
import { describe, expect, it } from "vitest";
import {
  defaultPermissions,
  isUrlAllowed,
  isActionAllowed,
  actionLabelKey,
} from "../src/shared/permissions.js";

/* ─── defaultPermissions ─── */

describe("defaultPermissions", () => {
  it("returns review mode with empty lists", () => {
    const p = defaultPermissions();
    expect(p.mode).toBe("review");
    expect(p.allowList).toEqual([]);
    expect(p.blockList).toEqual([]);
  });
});

/* ─── isUrlAllowed ─── */

describe("isUrlAllowed", () => {
  const empty = defaultPermissions();

  it("allows any URL when allow-list is empty", () => {
    expect(isUrlAllowed("https://example.com", empty)).toBe(true);
    expect(isUrlAllowed("http://localhost:3000", empty)).toBe(true);
    expect(isUrlAllowed("https://github.com/GaberRB/polypus", empty)).toBe(true);
  });

  it("blocks URLs that match the block-list even when allow-list is empty", () => {
    const perms = { mode: "review" as const, allowList: [], blockList: ["bank.example.com"] };
    expect(isUrlAllowed("https://bank.example.com/login", perms)).toBe(false);
    expect(isUrlAllowed("https://example.com", perms)).toBe(true);
  });

  it("blocks URLs that don't match allow-list entries", () => {
    const perms = { mode: "review" as const, allowList: ["github.com"], blockList: [] };
    expect(isUrlAllowed("https://github.com/foo/bar", perms)).toBe(true);
    expect(isUrlAllowed("https://gitlab.com", perms)).toBe(false);
    expect(isUrlAllowed("https://example.com", perms)).toBe(false);
  });

  it("matches glob patterns with wildcards", () => {
    const perms = { mode: "review" as const, allowList: ["*.docs.io"], blockList: [] };
    expect(isUrlAllowed("https://react.docs.io/hooks", perms)).toBe(true);
    expect(isUrlAllowed("https://vue.docs.io", perms)).toBe(true);
    // *.docs.io = "any subdomain of docs.io", not docs.io itself
    expect(isUrlAllowed("https://docs.io", perms)).toBe(false);
    expect(isUrlAllowed("https://evil.com", perms)).toBe(false);
  });

  it("block-list has precedence over allow-list", () => {
    const perms = { mode: "review" as const, allowList: ["*"], blockList: ["bank.example.com"] };
    expect(isUrlAllowed("https://bank.example.com", perms)).toBe(false);
    expect(isUrlAllowed("https://github.com", perms)).toBe(true);
  });

  it("returns false for invalid URLs", () => {
    expect(isUrlAllowed("not-a-url", empty)).toBe(false);
  });

  it("handles subdomain matching", () => {
    const perms = { mode: "review" as const, allowList: ["github.com"], blockList: [] };
    expect(isUrlAllowed("https://sub.github.com", perms)).toBe(true);
    expect(isUrlAllowed("https://notgithub.com", perms)).toBe(false);
  });
});

/* ─── isActionAllowed ─── */

describe("isActionAllowed", () => {
  it("allows all actions in bypass mode", () => {
    expect(isActionAllowed("web_click", "bypass")).toBe(true);
    expect(isActionAllowed("web_type", "bypass")).toBe(true);
    expect(isActionAllowed("web_execute", "bypass")).toBe(true);
    expect(isActionAllowed("web_navigate", "bypass")).toBe(true);
  });

  it("allows all actions in review mode", () => {
    // review pede confirmação, mas não bloqueia a ação
    expect(isActionAllowed("web_click", "review")).toBe(true);
    expect(isActionAllowed("web_type", "review")).toBe(true);
    expect(isActionAllowed("web_navigate", "review")).toBe(true);
  });

  it("blocks mutating actions in plan mode", () => {
    expect(isActionAllowed("web_click", "plan")).toBe(false);
    expect(isActionAllowed("web_type", "plan")).toBe(false);
    expect(isActionAllowed("web_execute", "plan")).toBe(false);
  });

  it("allows read-only actions in plan mode", () => {
    expect(isActionAllowed("web_navigate", "plan")).toBe(true);
    expect(isActionAllowed("web_extract", "plan")).toBe(true);
    expect(isActionAllowed("web_scroll", "plan")).toBe(true);
    expect(isActionAllowed("web_screenshot", "plan")).toBe(true);
    expect(isActionAllowed("web_getHtml", "plan")).toBe(true);
    expect(isActionAllowed("web_wait", "plan")).toBe(true);
  });

  it("treats unknown actions as non-mutating (allowed in plan)", () => {
    expect(isActionAllowed("web_unknown", "plan")).toBe(true);
  });
});

/* ─── actionLabelKey ─── */

describe("actionLabelKey", () => {
  it("maps known actions to i18n keys", () => {
    expect(actionLabelKey("web_navigate")).toBe("web.navigate");
    expect(actionLabelKey("web_click")).toBe("web.click");
    expect(actionLabelKey("web_type")).toBe("web.type");
    expect(actionLabelKey("web_extract")).toBe("web.extract");
    expect(actionLabelKey("web_scroll")).toBe("web.scroll");
    expect(actionLabelKey("web_screenshot")).toBe("web.screenshot");
    expect(actionLabelKey("web_getHtml")).toBe("web.getHtml");
    expect(actionLabelKey("web_wait")).toBe("web.wait");
  });

  it("returns the input key as-is for unknown actions", () => {
    expect(actionLabelKey("web_foo")).toBe("web_foo");
    expect(actionLabelKey("")).toBe("");
  });
});