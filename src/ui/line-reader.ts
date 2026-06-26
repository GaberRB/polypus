import * as readline from "node:readline/promises";
import { PassThrough } from "node:stream";
import { stdin, stdout } from "node:process";
import { PasteStore, PasteFilter } from "./paste.js";
import { pickFile } from "./file-picker.js";
import { t } from "../core/i18n/index.js";

const ENABLE_BRACKETED_PASTE = "\x1b[?2004h";
const DISABLE_BRACKETED_PASTE = "\x1b[?2004l";

/** Key codes for keyboard shortcuts. */
const KEY_SHIFT_TAB = "\x1b[Z";

export interface ReadLineOptions {
  /** Workspace root used by the `@` file picker. Disables the picker when omitted. */
  workspace?: string;
}

/**
 * Read a single line from the user. On a TTY, enables bracketed paste so a large
 * multi-line paste is shown compactly as `[Pasted text #N +M lines]` while the
 * full text is preserved and returned. Falls back to a plain readline when stdin
 * is not a TTY (pipes, tests). Returns `null` on EOF / Ctrl+C.
 */
export async function readLine(prompt: string, opts: ReadLineOptions = {}): Promise<string | null> {
  if (!stdin.isTTY) {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    try {
      return await rl.question(prompt);
    } catch {
      return null;
    } finally {
      rl.close();
    }
  }
  return readLineTTY(prompt, opts);
}

async function readLineTTY(prompt: string, opts: ReadLineOptions): Promise<string | null> {
  const store = new PasteStore((id, lines) => t("repl.pasted", { id, lines }));
  const filter = new PasteFilter(store);

  // The real TTY is driven in raw mode by us; readline does the line editing and
  // echo on a proxy stream (terminal:true) fed with paste-filtered input.
  const proxy = new PassThrough();
  const rl = readline.createInterface({ input: proxy, output: stdout, terminal: true });

  // Last printable char forwarded to readline, used to decide whether an `@`
  // sits at a word boundary (so we don't fire the picker inside e.g. an email).
  let lastChar = "";
  let pickerOpen = false;

  const onData = (buf: Buffer): void => {
    const input = buf.toString("utf8");
    if (pickerOpen) return; // the picker owns stdin while it is open

    // `@` at a word boundary opens the file picker instead of being typed.
    if (
      opts.workspace &&
      input === "@" &&
      (lastChar === "" || /\s/.test(lastChar))
    ) {
      pickerOpen = true;
      stdin.off("data", onData);
      void pickFile(opts.workspace)
        .then((choice) => {
          if (choice) {
            proxy.write(`@${choice} `);
            lastChar = " ";
          } else {
            proxy.write("@");
            lastChar = "@";
          }
        })
        .finally(() => {
          stdin.on("data", onData);
          pickerOpen = false;
        });
      return;
    }

    if (input === KEY_SHIFT_TAB) {
      // Shift+Tab is handled in the REPL loop for mode toggling.
      proxy.write(input);
    }
    // Track the boundary only for plain printable input (ignore escape seqs) so
    // we know whether a future `@` sits at a word start.
    if (input.length > 0 && !input.startsWith("\x1b")) lastChar = input.slice(-1);
    const filtered = filter.push(input);
    if (filtered) proxy.write(filtered);
  };

  stdout.write(ENABLE_BRACKETED_PASTE);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.on("data", onData);

  try {
    const line = await new Promise<string | null>((resolve) => {
      rl.question(prompt).then(resolve, () => resolve(null));
      rl.on("SIGINT", () => resolve(null));
      rl.on("close", () => resolve(null));
    });
    return line === null ? null : store.expand(line);
  } finally {
    stdin.off("data", onData);
    if (stdin.isTTY) stdin.setRawMode(false);
    stdout.write(DISABLE_BRACKETED_PASTE);
    rl.close();
  }
}
