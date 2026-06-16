import { describe, expect, it } from "vitest";
import { checkPath, globToRegExp, isCommandPreApproved } from "../src/core/permissions/allowlist.js";

const ws = process.platform === "win32" ? "C:\\ws" : "/ws";

describe("globToRegExp", () => {
  it("matches ** across segments", () => {
    expect(globToRegExp("src/**/*.ts").test("src/a/b/c.ts")).toBe(true);
    expect(globToRegExp("src/**/*.ts").test("src/c.ts")).toBe(true);
    expect(globToRegExp("src/**/*.ts").test("lib/c.ts")).toBe(false);
  });
  it("* stays within a segment", () => {
    expect(globToRegExp("*.ts").test("a.ts")).toBe(true);
    expect(globToRegExp("*.ts").test("a/b.ts")).toBe(false);
  });
});

describe("checkPath", () => {
  const policy = { workspace: ws, allow: ["src/**"], deny: [".git/**", "**/.env"] };

  it("allows files inside an allowed glob", () => {
    expect(checkPath(policy, "src/index.ts").allowed).toBe(true);
  });
  it("denies files outside the allow-list", () => {
    expect(checkPath(policy, "lib/x.ts").allowed).toBe(false);
  });
  it("deny-list wins over allow-list", () => {
    const p = { workspace: ws, allow: ["**/*"], deny: ["**/.env"] };
    expect(checkPath(p, ".env").allowed).toBe(false);
  });
  it("rejects path traversal outside the workspace", () => {
    expect(checkPath(policy, "../secret.txt").allowed).toBe(false);
  });
});

describe("isCommandPreApproved", () => {
  it("matches by prefix", () => {
    expect(isCommandPreApproved(["npm test"], "npm test")).toBe(true);
    expect(isCommandPreApproved(["npm"], "npm run build")).toBe(true);
    expect(isCommandPreApproved(["npm"], "rm -rf /")).toBe(false);
  });
});
