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
  it("picks typecheck/build/test/lint scripts from package.json in order", async () => {
    const ws = workspace();
    writeFileSync(
      join(ws, "package.json"),
      JSON.stringify({ scripts: { test: "vitest", build: "tsup", lint: "eslint", typecheck: "tsc" } }),
    );
    expect(await detectChecks(ws)).toEqual([
      "npm run typecheck",
      "npm run build",
      "npm run test",
      "npm run lint",
    ]);
  });

  it("returns [] when there is no recognizable project", async () => {
    expect(await detectChecks(workspace())).toEqual([]);
  });

  it("detects a Rust (Cargo) project", async () => {
    const ws = workspace();
    writeFileSync(join(ws, "Cargo.toml"), "[package]\nname='x'\n");
    expect(await detectChecks(ws)).toEqual(["cargo check", "cargo test"]);
  });

  it("detects a Go module", async () => {
    const ws = workspace();
    writeFileSync(join(ws, "go.mod"), "module example.com/x\n");
    expect(await detectChecks(ws)).toEqual(["go build ./...", "go test ./..."]);
  });

  it("detects Python pytest + declared linters", async () => {
    const ws = workspace();
    writeFileSync(
      join(ws, "pyproject.toml"),
      "[tool.pytest.ini_options]\n[tool.ruff]\n[tool.mypy]\n",
    );
    expect(await detectChecks(ws)).toEqual(["ruff check .", "mypy .", "pytest -q"]);
  });

  it("prefers the first matching ecosystem (Node over others)", async () => {
    const ws = workspace();
    writeFileSync(join(ws, "package.json"), JSON.stringify({ scripts: { test: "vitest" } }));
    writeFileSync(join(ws, "Cargo.toml"), "[package]\nname='x'\n");
    expect(await detectChecks(ws)).toEqual(["npm run test"]);
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
