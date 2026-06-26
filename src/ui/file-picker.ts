import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { stdin, stdout } from "node:process";
import pc from "picocolors";
import { t } from "../core/i18n/index.js";

/**
 * Interactive `@file` picker for the REPL. Triggered when the user types `@`, it
 * lists the workspace files, filters live as they keep typing, and lets them
 * arrow-select the file to reference. Returns the chosen workspace-relative path
 * (POSIX separators), or null if cancelled. Assumes the terminal is already in
 * raw mode and that the caller has detached any competing stdin listener.
 */

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", "coverage", ".turbo",
  ".poly", ".polypus", "target", "venv", ".venv", "__pycache__",
]);
const MAX_FILES = 5000;
const VISIBLE = 8;

/** Walk the workspace and return relative POSIX file paths (bounded). */
export async function listWorkspaceFiles(workspace: string, max = MAX_FILES): Promise<string[]> {
  const out: string[] = [];
  const walk = async (dir: string, rel: string): Promise<void> => {
    if (out.length >= max) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length >= max) return;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
        await walk(join(dir, entry.name), rel ? `${rel}/${entry.name}` : entry.name);
      } else if (entry.isFile()) {
        out.push(rel ? `${rel}/${entry.name}` : entry.name);
      }
    }
  };
  await walk(workspace, "");
  return out.sort();
}

/** Case-insensitive subsequence match (so "srvc" matches "src/service"). */
export function matches(file: string, query: string): boolean {
  if (!query) return true;
  const f = file.toLowerCase();
  const q = query.toLowerCase();
  let i = 0;
  for (const ch of f) {
    if (ch === q[i]) i++;
    if (i === q.length) return true;
  }
  return i === q.length;
}

interface PickState {
  query: string;
  selected: number;
  files: string[];
}

function filtered(state: PickState): string[] {
  return state.files.filter((f) => matches(f, state.query)).slice(0, 200);
}

/** ANSI helpers. */
const CSI = "\x1b[";

export async function pickFile(workspace: string, initialQuery = ""): Promise<string | null> {
  const files = await listWorkspaceFiles(workspace);
  const state: PickState = { query: initialQuery, selected: 0, files };

  let linesDrawn = 0;
  const render = (): void => {
    const list = filtered(state);
    if (state.selected >= list.length) state.selected = Math.max(0, list.length - 1);
    const top = Math.max(0, Math.min(state.selected - Math.floor(VISIBLE / 2), Math.max(0, list.length - VISIBLE)));
    const window = list.slice(top, top + VISIBLE);

    const out: string[] = [];
    out.push(pc.cyan("@ ") + pc.bold(state.query) + pc.dim("▏") + pc.dim("  " + t("picker.hint")));
    if (window.length === 0) {
      out.push(pc.dim("  " + t("picker.noMatches")));
    } else {
      window.forEach((file, i) => {
        const idx = top + i;
        const active = idx === state.selected;
        out.push((active ? pc.green("❯ ") : "  ") + (active ? pc.green(file) : file));
      });
    }
    out.push(pc.dim(`  ${list.length} ${t("picker.files")}`));

    // Move back to the top of the previous render and clear downward.
    if (linesDrawn > 0) stdout.write(`${CSI}${linesDrawn}A`);
    stdout.write(`${CSI}J`); // clear to end of screen
    stdout.write(out.map((l) => l + "\n").join(""));
    linesDrawn = out.length;
  };

  const teardown = (): void => {
    // Erase the picker block and step back onto the REPL's input line.
    if (linesDrawn > 0) stdout.write(`${CSI}${linesDrawn}A`);
    stdout.write(`${CSI}J`);
    stdout.write(`${CSI}1A`); // back up onto the readline prompt line
  };

  stdout.write("\n"); // open a line below the prompt for the picker
  render();

  return new Promise<string | null>((resolve) => {
    const onKey = (buf: Buffer): void => {
      const key = buf.toString("utf8");
      const list = filtered(state);

      if (key === "\x03" || key === "\x1b") {
        // Ctrl+C or Esc → cancel.
        cleanup();
        resolve(null);
        return;
      }
      if (key === "\r" || key === "\n") {
        const choice = list[state.selected];
        cleanup();
        resolve(choice ?? null);
        return;
      }
      if (key === `${CSI}A`) {
        state.selected = Math.max(0, state.selected - 1);
        render();
        return;
      }
      if (key === `${CSI}B`) {
        state.selected = Math.min(Math.max(0, list.length - 1), state.selected + 1);
        render();
        return;
      }
      if (key === "\x7f" || key === "\b") {
        state.query = state.query.slice(0, -1);
        state.selected = 0;
        render();
        return;
      }
      // Printable characters extend the filter (ignore other control sequences).
      if (key.length === 1 && key >= " ") {
        state.query += key;
        state.selected = 0;
        render();
      }
    };

    const cleanup = (): void => {
      stdin.off("data", onKey);
      teardown();
    };

    stdin.on("data", onKey);
  });
}
