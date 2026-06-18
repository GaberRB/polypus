/**
 * Bracketed-paste handling for the REPL. When a terminal has bracketed paste
 * enabled (`ESC[?2004h`), pasted text arrives wrapped in `ESC[200~ … ESC[201~`.
 * We capture multi-line pastes as a single unit, show a compact placeholder like
 * `[Pasted text #1 +16 lines]`, and keep the full text so the agent still sees it.
 */

export const PASTE_START = "\x1b[200~";
export const PASTE_END = "\x1b[201~";

/** Holds full pasted texts keyed by the placeholder shown in their place. */
export class PasteStore {
  private seq = 0;
  private readonly map = new Map<string, string>();

  /** `format(id, lines)` builds the placeholder (localized by the caller). */
  constructor(private readonly format: (id: number, lines: number) => string) {}

  /** Register pasted text, returning the placeholder to display in its place. */
  add(text: string): string {
    const lines = text.split(/\r\n|\r|\n/).length;
    const placeholder = this.format(++this.seq, lines);
    this.map.set(placeholder, text);
    return placeholder;
  }

  /** Replace any known placeholders in `line` with their full pasted text. */
  expand(line: string): string {
    let out = line;
    for (const [placeholder, full] of this.map) {
      if (out.includes(placeholder)) out = out.split(placeholder).join(full);
    }
    return out;
  }

  get size(): number {
    return this.map.size;
  }
}

/**
 * Streaming filter: feed it raw input chunks and it returns the text to forward
 * to the line editor, with multi-line pastes replaced by placeholders. Tolerates
 * paste markers split across chunk boundaries.
 */
export class PasteFilter {
  private buf = "";
  private inPaste = false;
  private pasteBuf = "";

  constructor(private readonly store: PasteStore) {}

  push(chunk: string): string {
    this.buf += chunk;
    let out = "";
    for (;;) {
      if (!this.inPaste) {
        const i = this.buf.indexOf(PASTE_START);
        if (i === -1) {
          const keep = partialSuffix(this.buf, PASTE_START);
          out += this.buf.slice(0, this.buf.length - keep);
          this.buf = this.buf.slice(this.buf.length - keep);
          return out;
        }
        out += this.buf.slice(0, i);
        this.buf = this.buf.slice(i + PASTE_START.length);
        this.inPaste = true;
      } else {
        const j = this.buf.indexOf(PASTE_END);
        if (j === -1) {
          const keep = partialSuffix(this.buf, PASTE_END);
          this.pasteBuf += this.buf.slice(0, this.buf.length - keep);
          this.buf = this.buf.slice(this.buf.length - keep);
          return out;
        }
        this.pasteBuf += this.buf.slice(0, j);
        this.buf = this.buf.slice(j + PASTE_END.length);
        this.inPaste = false;
        out += this.emit(this.pasteBuf);
        this.pasteBuf = "";
      }
    }
  }

  /** Multi-line pastes become a placeholder; single-line pastes pass through. */
  private emit(text: string): string {
    return /\r|\n/.test(text) ? this.store.add(text) : text;
  }
}

/** Length of the longest suffix of `s` that is a proper prefix of `marker`. */
function partialSuffix(s: string, marker: string): number {
  const max = Math.min(s.length, marker.length - 1);
  for (let n = max; n > 0; n--) {
    if (s.slice(s.length - n) === marker.slice(0, n)) return n;
  }
  return 0;
}
