import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { configDir } from "../config/store.js";
import type { Tool } from "../tools/types.js";

/**
 * A skill is a focused how-to guide the agent can pull in on demand. Skills live
 * as markdown files in two places, project-first:
 *   - project: `<workspace>/.poly/skills/*.md`
 *   - global:  `~/.polypus/skills/*.md`
 * Only their name + description are advertised to the model (cheap); the full
 * body is loaded only when the agent activates the skill via `use_skill`.
 */
export interface Skill {
  name: string;
  description: string;
  /** Absolute path to the markdown file. */
  path: string;
  scope: "project" | "global";
}

const SKILL_DIRS = (workspace: string): Array<{ dir: string; scope: "project" | "global" }> => [
  { dir: join(workspace, ".poly", "skills"), scope: "project" },
  { dir: join(configDir(), "skills"), scope: "global" },
];

/**
 * Load skills from the project and global directories. Project skills win over
 * global ones with the same name. Never throws — missing directories yield none.
 */
export async function loadSkills(workspace: string): Promise<Skill[]> {
  const byName = new Map<string, Skill>();
  // Load global first, then project, so project overrides on name collision.
  for (const { dir, scope } of [...SKILL_DIRS(workspace)].reverse()) {
    let entries: string[];
    try {
      entries = (await readdir(dir)).filter((f) => f.toLowerCase().endsWith(".md"));
    } catch {
      continue; // directory missing
    }
    for (const file of entries) {
      const path = join(dir, file);
      try {
        const raw = await readFile(path, "utf8");
        const meta = parseFrontmatter(raw, file);
        byName.set(meta.name.toLowerCase(), { ...meta, path, scope });
      } catch {
        /* unreadable — skip */
      }
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Extract the body of a skill file (everything after the frontmatter block). */
export function skillBody(raw: string): string {
  const m = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(raw);
  return (m ? raw.slice(m[0].length) : raw).trim();
}

interface SkillMeta {
  name: string;
  description: string;
}

/** Parse `name`/`description` from YAML-ish frontmatter, with sane fallbacks. */
function parseFrontmatter(raw: string, file: string): SkillMeta {
  const fallbackName = basename(file).replace(/\.md$/i, "");
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  let name = fallbackName;
  let description = "";
  if (fm) {
    for (const line of fm[1]!.split(/\r?\n/)) {
      const kv = /^(\w+):\s*(.*)$/.exec(line.trim());
      if (!kv) continue;
      const key = kv[1]!.toLowerCase();
      const val = kv[2]!.replace(/^["']|["']$/g, "").trim();
      if (key === "name" && val) name = val;
      else if (key === "description" && val) description = val;
    }
  }
  if (!description) {
    // First non-empty, non-heading line of the body becomes the description.
    const body = skillBody(raw);
    const firstLine = body.split(/\r?\n/).map((l) => l.trim()).find((l) => l && !l.startsWith("#"));
    description = (firstLine ?? "").slice(0, 200);
  }
  return { name, description };
}

/** Render the skills index injected into the system prompt. */
export function formatSkillsIndex(skills: Skill[]): string {
  if (skills.length === 0) return "";
  const lines = skills.map((s) => `- ${s.name}: ${s.description}`);
  return [
    "AVAILABLE SKILLS — focused how-to guides for this project.",
    "When a skill matches the task, call the `use_skill` tool with its exact name to load its full",
    "instructions BEFORE doing the related work. Skills:",
    "",
    ...lines,
  ].join("\n");
}

/**
 * Build the `use_skill` tool bound to the loaded skills. Activating a skill
 * returns its full instructions and notifies the host (so it can show that the
 * skill was activated). Created per-run because the skill set is dynamic.
 */
export function makeUseSkillTool(skills: Skill[]): Tool {
  const byName = new Map(skills.map((s) => [s.name.toLowerCase(), s]));
  return {
    mutating: false,
    spec: {
      name: "use_skill",
      description:
        "Load the full instructions of a project skill by name. Call this before " +
        "doing work a skill covers. Returns the skill's markdown guide.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Exact skill name from the skills index" },
        },
        required: ["name"],
      },
    },
    async run(rawArgs, ctx) {
      const name = typeof rawArgs.name === "string" ? rawArgs.name.trim() : "";
      const skill = byName.get(name.toLowerCase());
      if (!skill) {
        const avail = skills.map((s) => s.name).join(", ") || "(none)";
        return { ok: false, output: `No skill named "${name}". Available skills: ${avail}.` };
      }
      try {
        const body = skillBody(await readFile(skill.path, "utf8"));
        ctx.onSkill?.(skill.name, skill.scope);
        return { ok: true, output: `# Skill: ${skill.name} (${skill.scope})\n\n${body}` };
      } catch {
        return { ok: false, output: `Could not read skill "${skill.name}".` };
      }
    },
  };
}
