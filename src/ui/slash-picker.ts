import { stdin, stdout } from "node:process";
import pc from "picocolors";
import { t } from "../core/i18n/index.js";

/**
 * Interactive `/command` picker for the REPL. Triggered when the user types `/`
 * at the start of a line, it lists the slash commands, filters live as they keep
 * typing, and lets them arrow-select one. Returns the bare command name (e.g.
 * "usage"), or null if cancelled. Assumes the terminal is already in raw mode and
 * the caller has detached any competing stdin listener.
 */

const VISIBLE = 8;
const CSI = "\x1b[";

export interface SlashItem {
  /** Bare command inserted on select, e.g. "usage". */
  cmd: string;
  /** Display label including arg hint, e.g. "/agent <name>". */
  label: string;
  /** Short description. */
  hint: string;
}

/** Parse the localized `repl.slashList` ("/label\thint" per line) into items. */
export function slashItems(): SlashItem[] {
  return t("repl.slashList")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label = "", hint = ""] = line.split("\t");
      const cmd = label.replace(/^\//, "").split(/\s+/)[0] ?? "";
      return { cmd, label, hint };
    });
}

/** Case-insensitive subsequence match against the bare command name. */
export function matchesCmd(cmd: string, query: string): boolean {
  if (!query) return true;
  const c = cmd.toLowerCase();
  const q = query.toLowerCase();
  let i = 0;
  for (const ch of c) {
    if (ch === q[i]) i++;
    if (i === q.length) return true;
  }
  return i === q.length;
}

interface PickState {
  query: string;
  selected: number;
  items: SlashItem[];
}

function filtered(state: PickState): SlashItem[] {
  return state.items.filter((it) => matchesCmd(it.cmd, state.query));
}

export async function pickSlash(initialQuery = ""): Promise<string | null> {
  const state: PickState = { query: initialQuery, selected: 0, items: slashItems() };

  // Pad labels to a common width so the hints line up.
  const labelW = Math.min(28, Math.max(...state.items.map((it) => it.label.length), 0) + 2);

  let linesDrawn = 0;
  const render = (): void => {
    const list = filtered(state);
    if (state.selected >= list.length) state.selected = Math.max(0, list.length - 1);
    const top = Math.max(0, Math.min(state.selected - Math.floor(VISIBLE / 2), Math.max(0, list.length - VISIBLE)));
    const window = list.slice(top, top + VISIBLE);

    const out: string[] = [];
    out.push(pc.cyan("/ ") + pc.bold(state.query) + pc.dim("▏") + pc.dim("  " + t("picker.hint")));
    if (window.length === 0) {
      out.push(pc.dim("  " + t("picker.noMatches")));
    } else {
      window.forEach((it, i) => {
        const idx = top + i;
        const active = idx === state.selected;
        const label = it.label.padEnd(labelW);
        const row = (active ? pc.green(label) : label) + pc.dim(it.hint);
        out.push((active ? pc.green("❯ ") : "  ") + row);
      });
    }

    if (linesDrawn > 0) stdout.write(`${CSI}${linesDrawn}A`);
    stdout.write(`${CSI}J`);
    stdout.write(out.map((l) => l + "\n").join(""));
    linesDrawn = out.length;
  };

  const teardown = (): void => {
    if (linesDrawn > 0) stdout.write(`${CSI}${linesDrawn}A`);
    stdout.write(`${CSI}J`);
    stdout.write(`${CSI}1A`); // back up onto the readline prompt line
  };

  stdout.write("\n");
  render();

  return new Promise<string | null>((resolve) => {
    const onKey = (buf: Buffer): void => {
      const key = buf.toString("utf8");
      const list = filtered(state);

      if (key === "\x03" || key === "\x1b") {
        cleanup();
        resolve(null);
        return;
      }
      if (key === "\r" || key === "\n") {
        const choice = list[state.selected];
        cleanup();
        resolve(choice?.cmd ?? null);
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
      // Only letters/hyphens extend the command filter; anything else is ignored.
      if (key.length === 1 && /[a-zA-Z-]/.test(key)) {
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
