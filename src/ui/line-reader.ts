import * as readline from "node:readline/promises";
import { PassThrough } from "node:stream";
import { stdin, stdout } from "node:process";
import { PasteStore, PasteFilter } from "./paste.js";
import { t } from "../core/i18n/index.js";

const ENABLE_BRACKETED_PASTE = "\x1b[?2004h";
const DISABLE_BRACKETED_PASTE = "\x1b[?2004l";

/**
 * Read a single line from the user. On a TTY, enables bracketed paste so a large
 * multi-line paste is shown compactly as `[Pasted text #N +M lines]` while the
 * full text is preserved and returned. Falls back to a plain readline when stdin
 * is not a TTY (pipes, tests). Returns `null` on EOF / Ctrl+C.
 */
export async function readLine(prompt: string): Promise<string | null> {
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
  return readLineTTY(prompt);
}

async function readLineTTY(prompt: string): Promise<string | null> {
  const store = new PasteStore((id, lines) => t("repl.pasted", { id, lines }));
  const filter = new PasteFilter(store);

  // The real TTY is driven in raw mode by us; readline does the line editing and
  // echo on a proxy stream (terminal:true) fed with paste-filtered input.
  const proxy = new PassThrough();
  const rl = readline.createInterface({ input: proxy, output: stdout, terminal: true });
  const onData = (buf: Buffer): void => {
    proxy.write(filter.push(buf.toString("utf8")));
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
