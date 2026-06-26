import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadSkills, makeUseSkillTool, skillBody, formatSkillsIndex } from "../src/core/skills/index.js";

const dirs: string[] = [];
function tmp(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(d);
  return d;
}

let prevHome: string | undefined;
beforeEach(() => {
  prevHome = process.env.POLYPUS_HOME;
});
afterEach(() => {
  if (prevHome === undefined) delete process.env.POLYPUS_HOME;
  else process.env.POLYPUS_HOME = prevHome;
  for (const d of dirs.splice(0)) {
    try { rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

function writeSkill(dir: string, file: string, content: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, file), content);
}

describe("skillBody", () => {
  it("strips YAML frontmatter", () => {
    expect(skillBody("---\nname: x\n---\nbody here")).toBe("body here");
    expect(skillBody("no frontmatter")).toBe("no frontmatter");
  });
});

describe("loadSkills", () => {
  it("parses frontmatter name/description and derives fallbacks", async () => {
    const ws = tmp("poly-skills-ws-");
    process.env.POLYPUS_HOME = tmp("poly-skills-home-");
    writeSkill(
      join(ws, ".poly", "skills"),
      "deploy.md",
      "---\nname: deploy\ndescription: how to ship a release\n---\n# Deploy\nsteps...",
    );
    writeSkill(join(ws, ".poly", "skills"), "raw.md", "# Raw\nfirst real line is the description");

    const skills = await loadSkills(ws);
    const byName = Object.fromEntries(skills.map((s) => [s.name, s]));
    expect(byName.deploy!.description).toBe("how to ship a release");
    expect(byName.deploy!.scope).toBe("project");
    expect(byName.raw!.description).toBe("first real line is the description");
  });

  it("project skills override global ones of the same name", async () => {
    const ws = tmp("poly-skills-ws-");
    const home = tmp("poly-skills-home-");
    process.env.POLYPUS_HOME = home;
    writeSkill(join(home, "skills"), "review.md", "---\nname: review\ndescription: GLOBAL\n---\nglobal body");
    writeSkill(join(ws, ".poly", "skills"), "review.md", "---\nname: review\ndescription: PROJECT\n---\nproject body");

    const skills = await loadSkills(ws);
    const review = skills.find((s) => s.name === "review")!;
    expect(review.description).toBe("PROJECT");
    expect(review.scope).toBe("project");
  });

  it("loads global-only skills when no project skills exist", async () => {
    const ws = tmp("poly-skills-ws-");
    const home = tmp("poly-skills-home-");
    process.env.POLYPUS_HOME = home;
    writeSkill(join(home, "skills"), "g.md", "---\nname: g\ndescription: global skill\n---\nbody");

    const skills = await loadSkills(ws);
    expect(skills.map((s) => s.name)).toContain("g");
    expect(skills[0]!.scope).toBe("global");
  });

  it("returns [] when there are no skill directories", async () => {
    process.env.POLYPUS_HOME = tmp("poly-skills-home-");
    expect(await loadSkills(tmp("poly-skills-ws-"))).toEqual([]);
  });
});

describe("formatSkillsIndex", () => {
  it("renders nothing for no skills and a list otherwise", () => {
    expect(formatSkillsIndex([])).toBe("");
    const idx = formatSkillsIndex([{ name: "a", description: "does a", path: "/x", scope: "project" }]);
    expect(idx).toContain("use_skill");
    expect(idx).toContain("- a: does a");
  });
});

describe("makeUseSkillTool", () => {
  it("activates a skill, returns its body, and notifies the host", async () => {
    const ws = tmp("poly-skills-ws-");
    const dir = join(ws, ".poly", "skills");
    writeSkill(dir, "coding.md", "---\nname: coding\ndescription: standards\n---\nUse small edits.");
    process.env.POLYPUS_HOME = tmp("poly-skills-home-");
    const skills = await loadSkills(ws);

    const tool = makeUseSkillTool(skills);
    let activated = "";
    const res = await tool.run({ name: "coding" }, {
      workspace: ws,
      permissions: {} as never,
      onSkill: (name) => { activated = name; },
    });
    expect(res.ok).toBe(true);
    expect(res.output).toContain("Use small edits.");
    expect(activated).toBe("coding");
  });

  it("fails gracefully for an unknown skill", async () => {
    const tool = makeUseSkillTool([]);
    const res = await tool.run({ name: "nope" }, { workspace: ".", permissions: {} as never });
    expect(res.ok).toBe(false);
    expect(res.output).toMatch(/No skill named/i);
  });
});
