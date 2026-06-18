import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Where project operating instructions live, in priority order (workspace-relative). */
const INSTRUCTION_FILES = [join(".poly", "agents.md"), "AGENTS.md"];

/** Hard cap so a large instructions file can't blow up the context window. */
const MAX_CHARS = 8000;

/**
 * Load project-specific operating instructions to inject into the agent's system
 * prompt — the polypus equivalent of an `AGENTS.md`/`CLAUDE.md`. Reads the first
 * file that exists from {@link INSTRUCTION_FILES}, trims it, and caps the length.
 * Returns `undefined` when no instructions file is present (the common case for
 * throwaway swarm worktrees, which don't carry the gitignored `.poly/`).
 */
export async function loadProjectInstructions(workspace: string): Promise<string | undefined> {
  for (const rel of INSTRUCTION_FILES) {
    try {
      const raw = (await readFile(join(workspace, rel), "utf8")).trim();
      if (!raw) continue;
      return raw.length > MAX_CHARS ? raw.slice(0, MAX_CHARS) + "\n…(truncated)" : raw;
    } catch {
      /* file missing/unreadable — try the next candidate */
    }
  }
  return undefined;
}
