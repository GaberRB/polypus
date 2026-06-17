const RESET = "\x1b[0m";
const isTTY = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const violet = (s: string) => (isTTY ? `\x1b[38;2;167;139;250m${s}${RESET}` : s);
const dim = (s: string) => (isTTY ? `\x1b[2m${s}${RESET}` : s);

/**
 * Single-line animated "thinking" indicator with an octopus icon and elapsed
 * time, e.g. `⠹ 🐙 pensando… (3s)`. No-op when stdout is not a TTY so piped
 * output and logs stay clean.
 */
export class Spinner {
  private timer: NodeJS.Timeout | undefined;
  private frame = 0;
  private startedAt = 0;
  private label = "";
  private suffix = "";

  /** Extra dim text appended after the elapsed time (e.g. token count). */
  setSuffix(suffix: string): void {
    this.suffix = suffix;
  }

  /** Start (or, if already running, just update the label). */
  start(label: string): void {
    this.label = label;
    if (!isTTY) return;
    if (this.timer) return; // already animating; label updated above
    this.startedAt = Date.now();
    this.render();
    this.timer = setInterval(() => this.render(), 90);
    // Avoid keeping the process alive solely for the spinner.
    this.timer.unref?.();
  }

  /** Erase the spinner line and stop animating. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    if (isTTY) process.stdout.write("\r\x1b[K");
  }

  private render(): void {
    const f = violet(FRAMES[this.frame = (this.frame + 1) % FRAMES.length]!);
    const secs = Math.floor((Date.now() - this.startedAt) / 1000);
    const time = secs > 0 ? dim(` (${secs}s)`) : "";
    const suffix = this.suffix ? dim(` · ${this.suffix}`) : "";
    process.stdout.write(`\r\x1b[K${f} 🐙 ${dim(this.label + "…")}${time}${suffix}`);
  }
}
