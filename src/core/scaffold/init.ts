import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Locale } from "../i18n/index.js";
import { polyTemplates } from "./templates.js";

export interface ScaffoldResult {
  /** Files written, as `.poly/`-prefixed forward-slash paths. */
  created: string[];
  /** Files left untouched because they already existed (without `--force`). */
  skipped: string[];
}

/**
 * Scaffold the `.poly/` workspace in `workspace`. Idempotent: existing files are
 * preserved unless `force` is set. Creates parent directories as needed.
 */
export async function scaffoldPoly(
  workspace: string,
  opts: { force?: boolean; locale: Locale },
): Promise<ScaffoldResult> {
  const templates = polyTemplates(opts.locale);
  const created: string[] = [];
  const skipped: string[] = [];

  for (const [rel, content] of Object.entries(templates)) {
    const display = `.poly/${rel}`;
    const abs = join(workspace, ".poly", ...rel.split("/"));
    if (!opts.force && (await exists(abs))) {
      skipped.push(display);
      continue;
    }
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, content, "utf8");
    created.push(display);
  }

  return { created, skipped };
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
