const RESET = "\x1b[0m";
const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/** Minimal writable surface a Spinner needs; lets tests inject a fake stream. */
export interface SpinnerStream {
  write(data: string): unknown;
  isTTY?: boolean;
}

/**
 * Single-line animated "thinking" indicator with an octopus icon and elapsed
 * time, e.g. `⠹ 🐙 pensando… (3s)`. No-op when the stream is not a TTY so piped
 * output and logs stay clean.
 */
export class Spinner {
  private timer: NodeJS.Timeout | undefined;
  private frame = 0;
  private startedAt = 0;
  private label = "";
  private suffix = "";
  private readonly out: SpinnerStream;
  private readonly tty: boolean;

  constructor(out: SpinnerStream = process.stdout) {
    this.out = out;
    this.tty = Boolean(out.isTTY) && !process.env.NO_COLOR;
  }

  private violet(s: string): string {
    return this.tty ? `\x1b[38;2;167;139;250m${s}${RESET}` : s;
  }
  private dim(s: string): string {
    return this.tty ? `\x1b[2m${s}${RESET}` : s;
  }

  /** Extra dim text appended after the elapsed time (e.g. token count). */
  setSuffix(suffix: string): void {
    this.suffix = suffix;
  }

  /** Start (or, if already running, just update the label). */
  start(label: string): void {
    this.label = label;
    if (!this.tty) return;
    if (this.timer) return; // already animating; label updated above
    this.startedAt = Date.now();
    this.render();
    this.timer = setInterval(() => this.render(), 90);
    // Avoid keeping the process alive solely for the spinner.
    this.timer.unref?.();
  }

  /**
   * Erase the spinner line and stop animating. Idempotent: when the spinner is
   * not running this is a no-op — it must NOT emit the erase sequence, or it
   * would clobber unrelated output (e.g. text streamed between stop() calls).
   */
  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
    this.out.write("\r\x1b[K");
  }

  private render(): void {
    const f = this.violet(FRAMES[(this.frame = (this.frame + 1) % FRAMES.length)]!);
    const secs = Math.floor((Date.now() - this.startedAt) / 1000);
    const time = secs > 0 ? this.dim(` (${secs}s)`) : "";
    const suffix = this.suffix ? this.dim(` · ${this.suffix}`) : "";
    this.out.write(`\r\x1b[K${f} 🐙 ${this.dim(this.label + "…")}${time}${suffix}`);
  }
}
