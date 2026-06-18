import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadProjectInstructions } from "../src/core/agent/project-context.js";

const dirs: string[] = [];
function ws(): string {
  const d = mkdtempSync(join(tmpdir(), "polypus-ctx-"));
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

describe("loadProjectInstructions", () => {
  it("returns undefined when no instructions file exists", async () => {
    expect(await loadProjectInstructions(ws())).toBeUndefined();
  });

  it("loads .poly/agents.md when present", async () => {
    const dir = ws();
    mkdirSync(join(dir, ".poly"), { recursive: true });
    writeFileSync(join(dir, ".poly", "agents.md"), "# agents\nfollow the flow\n");
    expect(await loadProjectInstructions(dir)).toBe("# agents\nfollow the flow");
  });

  it("falls back to AGENTS.md at the root", async () => {
    const dir = ws();
    writeFileSync(join(dir, "AGENTS.md"), "root rules");
    expect(await loadProjectInstructions(dir)).toBe("root rules");
  });

  it("prefers .poly/agents.md over root AGENTS.md", async () => {
    const dir = ws();
    mkdirSync(join(dir, ".poly"), { recursive: true });
    writeFileSync(join(dir, ".poly", "agents.md"), "poly wins");
    writeFileSync(join(dir, "AGENTS.md"), "root rules");
    expect(await loadProjectInstructions(dir)).toBe("poly wins");
  });

  it("truncates very large files", async () => {
    const dir = ws();
    writeFileSync(join(dir, "AGENTS.md"), "x".repeat(20000));
    const out = await loadProjectInstructions(dir);
    expect(out?.endsWith("…(truncated)")).toBe(true);
    expect(out!.length).toBeLessThan(20000);
  });
});
