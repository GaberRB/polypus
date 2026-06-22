import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveMentions } from "../src/core/context/mentions.js";

const dirs: string[] = [];
function workspace(): string {
  const d = mkdtempSync(join(tmpdir(), "polypus-mentions-"));
  dirs.push(d);
  return d;
}
function policy(ws: string, allow = ["**/*"], deny: string[] = []) {
  return { workspace: ws, allow, deny };
}

afterEach(() => {
  for (const d of dirs.splice(0)) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

describe("resolveMentions", () => {
  it("injects the contents of a mentioned file", async () => {
    const ws = workspace();
    writeFileSync(join(ws, "banner.ts"), "export const V = 1;\n");
    const res = await resolveMentions("fix @banner.ts please", policy(ws));
    expect(res.injected).toEqual(["banner.ts"]);
    expect(res.task).toContain("export const V = 1;");
    expect(res.task).toContain("@banner.ts");
  });

  it("lists a mentioned directory", async () => {
    const ws = workspace();
    mkdirSync(join(ws, "src"));
    writeFileSync(join(ws, "src", "a.ts"), "a\n");
    writeFileSync(join(ws, "src", "b.ts"), "b\n");
    const res = await resolveMentions("look at @src/", policy(ws));
    expect(res.injected).toEqual(["src"]);
    expect(res.task).toContain("a.ts");
    expect(res.task).toContain("b.ts");
  });

  it("returns the task unchanged when there are no mentions", async () => {
    const ws = workspace();
    const res = await resolveMentions("just do the thing", policy(ws));
    expect(res.injected).toEqual([]);
    expect(res.task).toBe("just do the thing");
  });

  it("lists the current directory for a bare @ mention", async () => {
    const ws = workspace();
    writeFileSync(join(ws, "top.ts"), "t\n");
    mkdirSync(join(ws, "lib"));
    const res = await resolveMentions("what's in @ here?", policy(ws));
    expect(res.injected).toEqual(["."]);
    expect(res.task).toContain("top.ts");
    expect(res.task).toContain("lib/");
  });

  it("treats a trailing bare @ as a current-directory listing", async () => {
    const ws = workspace();
    writeFileSync(join(ws, "only.ts"), "x\n");
    const res = await resolveMentions("list everything @", policy(ws));
    expect(res.injected).toEqual(["."]);
    expect(res.task).toContain("only.ts");
  });

  it("does not treat an email-like @ as a mention", async () => {
    const ws = workspace();
    const res = await resolveMentions("ping me at user@host", policy(ws));
    expect(res.injected).toEqual([]);
    expect(res.task).toBe("ping me at user@host");
  });

  it("skips a path denied by the allow/deny-list", async () => {
    const ws = workspace();
    writeFileSync(join(ws, "secret.env"), "TOKEN=abc\n");
    const res = await resolveMentions("read @secret.env", policy(ws, ["**/*"], ["*.env"]));
    expect(res.injected).toEqual([]);
    // task is returned unchanged because nothing was actually injected
    expect(res.task).toBe("read @secret.env");
  });

  it("notes a missing file but does not throw", async () => {
    const ws = workspace();
    writeFileSync(join(ws, "real.ts"), "ok\n");
    const res = await resolveMentions("see @real.ts and @ghost.ts", policy(ws));
    expect(res.injected).toEqual(["real.ts"]);
    expect(res.task).toMatch(/ghost\.ts/);
  });
});
