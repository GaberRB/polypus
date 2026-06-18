import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scaffoldPoly } from "../src/core/scaffold/init.js";
import { polyTemplates } from "../src/core/scaffold/templates.js";

const dirs: string[] = [];
function ws(): string {
  const d = mkdtempSync(join(tmpdir(), "polypus-init-"));
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

describe("scaffoldPoly", () => {
  it("creates the .poly workspace with all template files", async () => {
    const dir = ws();
    const res = await scaffoldPoly(dir, { locale: "en" });

    expect(res.skipped).toEqual([]);
    expect(res.created).toContain(".poly/agents.md");
    expect(res.created).toContain(".poly/README.md");
    expect(res.created).toContain(".poly/skills/coding.md");
    expect(res.created).toContain(".poly/skills/spec-driven.md");
    expect(res.created).toContain(".poly/templates/spec.md");

    expect(existsSync(join(dir, ".poly", "agents.md"))).toBe(true);
    expect(existsSync(join(dir, ".poly", "templates", "spec.md"))).toBe(true);
  });

  it("is idempotent: keeps existing files instead of overwriting", async () => {
    const dir = ws();
    mkdirSync(join(dir, ".poly"), { recursive: true });
    writeFileSync(join(dir, ".poly", "agents.md"), "MINE");

    const res = await scaffoldPoly(dir, { locale: "en" });

    expect(res.skipped).toContain(".poly/agents.md");
    expect(res.created).not.toContain(".poly/agents.md");
    expect(readFileSync(join(dir, ".poly", "agents.md"), "utf8")).toBe("MINE");
  });

  it("overwrites when force is set", async () => {
    const dir = ws();
    mkdirSync(join(dir, ".poly"), { recursive: true });
    writeFileSync(join(dir, ".poly", "agents.md"), "MINE");

    const res = await scaffoldPoly(dir, { locale: "en", force: true });

    expect(res.skipped).toEqual([]);
    expect(res.created).toContain(".poly/agents.md");
    expect(readFileSync(join(dir, ".poly", "agents.md"), "utf8")).not.toBe("MINE");
  });

  it("scaffolds locale-specific content", async () => {
    const dir = ws();
    await scaffoldPoly(dir, { locale: "pt-BR" });
    expect(readFileSync(join(dir, ".poly", "agents.md"), "utf8")).toContain("Regras de ouro");
  });

  it("ships the same set of files in both locales", () => {
    expect(Object.keys(polyTemplates("en")).sort()).toEqual(Object.keys(polyTemplates("pt-BR")).sort());
  });
});
