import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildVerifyFeedback, detectChecks, runChecks } from "../src/core/agent/verify.js";

const dirs: string[] = [];
function workspace(): string {
  const d = mkdtempSync(join(tmpdir(), "polypus-verify-"));
  dirs.push(d);
  return d;
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

describe("detectChecks", () => {
  it("picks typecheck/build/test scripts from package.json in order", async () => {
    const ws = workspace();
    writeFileSync(
      join(ws, "package.json"),
      JSON.stringify({ scripts: { test: "vitest", build: "tsup", lint: "eslint" } }),
    );
    expect(await detectChecks(ws)).toEqual(["npm run build", "npm run test"]);
  });

  it("returns [] when there is no package.json", async () => {
    expect(await detectChecks(workspace())).toEqual([]);
  });
});

describe("runChecks", () => {
  it("reports a passing and a failing command", async () => {
    const ws = workspace();
    const results = await runChecks(ws, [
      "node -e \"process.exit(0)\"",
      "node -e \"console.error('boom'); process.exit(1)\"",
    ]);
    expect(results[0]!.ok).toBe(true);
    expect(results[1]!.ok).toBe(false);
    expect(results[1]!.output).toContain("boom");
  });
});

describe("buildVerifyFeedback", () => {
  it("includes the failing commands and their output", () => {
    const msg = buildVerifyFeedback([{ command: "npm run test", ok: false, output: "1 failing" }]);
    expect(msg).toContain("npm run test");
    expect(msg).toContain("1 failing");
    expect(msg).toMatch(/finish/);
  });
});
