import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildDiagnosticsFeedback,
  detectDiagnostics,
  runDiagnostics,
  type DiagnosticProbe,
} from "../src/core/agent/diagnostics.js";

let ws: string;
beforeEach(() => {
  ws = mkdtempSync(join(tmpdir(), "polypus-diag-"));
});
afterEach(() => {
  try {
    rmSync(ws, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe("detectDiagnostics", () => {
  it("returns a tsc probe when tsconfig.json is present", async () => {
    writeFileSync(join(ws, "tsconfig.json"), "{}");
    const probes = await detectDiagnostics(ws);
    expect(probes.some((p) => p.command.includes("tsc --noEmit"))).toBe(true);
  });

  it("returns a ruff probe when pyproject declares ruff", async () => {
    writeFileSync(join(ws, "pyproject.toml"), "[tool.ruff]\nline-length = 100\n");
    const probes = await detectDiagnostics(ws);
    const ruff = probes.find((p) => p.command.startsWith("ruff"));
    expect(ruff?.perFile).toBe(true);
  });

  it("returns nothing for a bare workspace", async () => {
    expect(await detectDiagnostics(ws)).toEqual([]);
  });
});

describe("runDiagnostics", () => {
  // A whole-project probe that prints two diagnostic-shaped lines via node,
  // so the test is cross-platform and doesn't need a real toolchain installed.
  const printingProbe: DiagnosticProbe = {
    command:
      "node -e \"console.log('src/foo.ts(1,1): error TS1: bad'); console.log('src/other.ts(2,2): error TS2: nope')\"",
    match: /\.(ts|tsx)$/i,
  };

  it("returns null when no source files were touched", async () => {
    expect(await runDiagnostics(ws, ["README.md"], { probes: [printingProbe] })).toBeNull();
  });

  it("returns null when there are no probes", async () => {
    expect(await runDiagnostics(ws, ["src/foo.ts"], { probes: [] })).toBeNull();
  });

  it("keeps only the diagnostics that reference the touched files", async () => {
    const out = await runDiagnostics(ws, ["src/foo.ts"], { probes: [printingProbe] });
    expect(out).toContain("src/foo.ts(1,1): error TS1: bad");
    expect(out).not.toContain("other.ts");
  });

  it("skips a probe that overruns its timeout without throwing", async () => {
    const slow: DiagnosticProbe = { command: "node -e \"setTimeout(()=>{}, 3000)\"", match: /\.ts$/i };
    const out = await runDiagnostics(ws, ["src/foo.ts"], { probes: [slow], timeoutMs: 150 });
    expect(out).toBeNull();
  });

  it("skips a probe whose command is not installed", async () => {
    const missing: DiagnosticProbe = { command: "polypus-not-a-real-binary-xyz", match: /\.ts$/i };
    const out = await runDiagnostics(ws, ["src/foo.ts"], { probes: [missing] });
    expect(out).toBeNull();
  });
});

describe("buildDiagnosticsFeedback", () => {
  it("frames the errors as a fix-now instruction", () => {
    const msg = buildDiagnosticsFeedback("src/foo.ts(1,1): error TS1: bad");
    expect(msg).toContain("src/foo.ts(1,1): error TS1: bad");
    expect(msg.toLowerCase()).toContain("fix");
  });
});
