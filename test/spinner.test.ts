import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Spinner, type SpinnerStream } from "../src/ui/spinner.js";

class FakeStream implements SpinnerStream {
  isTTY = true;
  writes: string[] = [];
  write(data: string): boolean {
    this.writes.push(data);
    return true;
  }
}

const ERASE = "\r\x1b[K";

// The spinner disables itself when NO_COLOR is set; keep tests deterministic.
let savedNoColor: string | undefined;
beforeEach(() => {
  savedNoColor = process.env.NO_COLOR;
  delete process.env.NO_COLOR;
});
afterEach(() => {
  if (savedNoColor !== undefined) process.env.NO_COLOR = savedNoColor;
});

describe("Spinner", () => {
  it("is a no-op stop() when never started", () => {
    const out = new FakeStream();
    const spin = new Spinner(out);
    spin.stop();
    expect(out.writes).toEqual([]);
  });

  it("renders a frame on start and erases the line once on stop", () => {
    const out = new FakeStream();
    const spin = new Spinner(out);
    spin.start("pensando");
    expect(out.writes.at(-1)).toContain("🐙");
    out.writes.length = 0;
    spin.stop();
    expect(out.writes).toEqual([ERASE]);
  });

  it("does not erase text streamed after it already stopped (regression #110)", () => {
    const out = new FakeStream();
    const spin = new Spinner(out);
    spin.start("pensando");
    spin.stop(); // first delta stops the spinner once

    // Simulate streamed assistant text arriving chunk by chunk; each chunk used
    // to call stop() again, which previously re-emitted ERASE and clobbered it.
    out.writes.length = 0;
    for (const chunk of ["ola", " mun", "do"]) {
      spin.stop(); // must be a no-op now
      out.write(chunk);
    }
    expect(out.writes).toEqual(["ola", " mun", "do"]);
    expect(out.writes).not.toContain(ERASE);
  });

  it("stays silent when the stream is not a TTY", () => {
    const out = new FakeStream();
    out.isTTY = false;
    const spin = new Spinner(out);
    spin.start("pensando");
    spin.stop();
    expect(out.writes).toEqual([]);
  });
});
