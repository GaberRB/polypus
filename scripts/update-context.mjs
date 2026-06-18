#!/usr/bin/env node
// Regenerates the auto-generated "module map" block in context.md from the
// source tree, using each file's leading comment as its one-line description.
// Deterministic (no LLM): run `npm run context`; CI fails if it drifts.

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const CONTEXT = join(ROOT, "context.md");
const BEGIN = "<!-- AUTO:BEGIN (gerado por `npm run context`; não editar à mão) -->";
const END = "<!-- AUTO:END -->";

/** Recursively collect non-test .ts files under a directory. */
function collect(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...collect(full));
    else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

/** Extract a one-line description from a file's leading comment. */
function describe(file) {
  const lines = readFileSync(file, "utf8").split("\n").slice(0, 25);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "") continue;
    if (line.startsWith("/**") || line.startsWith("/*")) {
      // First non-empty text line inside the block comment.
      const inline = line.replace(/^\/\*\*?/, "").replace(/\*\/$/, "").replace(/^\*/, "").trim();
      if (inline) return clean(inline);
      for (let j = i + 1; j < lines.length; j++) {
        const t = lines[j].trim().replace(/^\*\/?/, "").replace(/\*\/$/, "").trim();
        if (t) return clean(t);
      }
      return "";
    }
    if (line.startsWith("//")) return clean(line.replace(/^\/\/+/, "").trim());
    return ""; // first real line is code, not a comment
  }
  return "";
}

function clean(s) {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > 110 ? one.slice(0, 109) + "…" : one;
}

function buildBlock() {
  const files = collect(SRC);
  const byDir = new Map();
  for (const f of files) {
    const rel = relative(ROOT, f).replace(/\\/g, "/");
    const dir = rel.slice(0, rel.lastIndexOf("/"));
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir).push({ name: rel.slice(rel.lastIndexOf("/") + 1), desc: describe(f) });
  }
  const dirs = [...byDir.keys()].sort();
  const parts = [`_${files.length} módulos em \`src/\`._\n`];
  for (const dir of dirs) {
    parts.push(`### \`${dir}\``);
    for (const { name, desc } of byDir.get(dir)) {
      parts.push(desc ? `- \`${name}\` — ${desc}` : `- \`${name}\``);
    }
    parts.push("");
  }
  return parts.join("\n").trimEnd();
}

const md = readFileSync(CONTEXT, "utf8");
const b = md.indexOf(BEGIN);
const e = md.indexOf(END);
if (b === -1 || e === -1 || e < b) {
  console.error(`context.md must contain the markers:\n${BEGIN}\n${END}`);
  process.exit(1);
}
const updated = md.slice(0, b + BEGIN.length) + "\n\n" + buildBlock() + "\n\n" + md.slice(e);
writeFileSync(CONTEXT, updated, "utf8");
console.log("✓ context.md module map regenerated.");
