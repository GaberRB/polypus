import { createRequire } from "node:module";

/**
 * Single source of truth for the CLI version, read from package.json at runtime.
 * Tries the bundled path first (dist/index.js → repo root) and falls back to the
 * source-tree path (src/core → repo root), so it resolves both from the tsup
 * bundle and when running from source (tests). Each candidate's version field is
 * validated so a stray package.json higher up the tree can't yield `undefined`.
 */
function resolveVersion(): string {
  const require = createRequire(import.meta.url);
  for (const rel of ["../package.json", "../../package.json"]) {
    try {
      const version = (require(rel) as { version?: unknown }).version;
      if (typeof version === "string" && version.length > 0) return version;
    } catch {
      /* try the next candidate path */
    }
  }
  return "0.0.0";
}

export const VERSION: string = resolveVersion();
