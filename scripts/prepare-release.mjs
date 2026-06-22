// Prepare a patch release: bump package.json, add a CHANGELOG section, and update
// the compare links. Used by the autonomous agent workflow so the PR it opens is
// already release-ready (merging it triggers auto-release → npm publish).
//
// Usage: node scripts/prepare-release.mjs "<summary>" "<issue number>"

import { readFileSync, writeFileSync } from "node:fs";

const summary = (process.argv[2] || "Autonomous change").replace(/\s+/g, " ").trim();
const issue = (process.argv[3] || "").replace(/[^0-9]/g, "");

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const prev = pkg.version;
const [maj, min, pat] = prev.split(".").map(Number);
if (![maj, min, pat].every(Number.isFinite)) {
  throw new Error(`Cannot parse current version "${prev}"`);
}
const next = `${maj}.${min}.${pat + 1}`;
pkg.version = next;
writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");

const date = new Date().toISOString().slice(0, 10);
const ref = issue ? ` (#${issue})` : "";
let changelog = readFileSync("CHANGELOG.md", "utf8");

const section = `## [Unreleased]\n\n## [${next}] - ${date}\n\n### Changed\n- ${summary}${ref}\n`;
if (!changelog.includes("## [Unreleased]\n")) {
  throw new Error("CHANGELOG.md is missing the '## [Unreleased]' heading");
}
changelog = changelog.replace("## [Unreleased]\n", section);

// Update the comparison links at the bottom: point Unreleased at the new tag and
// add a line for the new version.
changelog = changelog.replace(
  /\[Unreleased\]: (.*)\/compare\/v[0-9][^.]*\.[^.]*\.[^.]*\.\.\.HEAD/,
  `[Unreleased]: $1/compare/v${next}...HEAD\n[${next}]: $1/compare/v${prev}...v${next}`,
);
writeFileSync("CHANGELOG.md", changelog);

console.log(`Prepared release v${next} (from v${prev}).`);
