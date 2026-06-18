export interface CancelListener {
  /** Temporarily stop listening (e.g. to hand stdin to a clack prompt). */
  pause(): void;
  /** Resume listening after a pause. */
  resume(): void;
  /** Stop listening and restore the terminal. */
  dispose(): void;
}

/**
 * While a long task runs, listen on raw stdin for ESC (0x1b) or Ctrl+C (0x03)
 * and abort the controller. `pause()`/`resume()` let a clack confirmation borrow
 * stdin. No-op when stdin is not a TTY (pipes, tests). Shared by `polypus run`
 * and `polypus swarm`.
 */
export function listenForCancel(controller: AbortController): CancelListener {
  const stdin = process.stdin;
  if (!stdin.isTTY) return { pause() {}, resume() {}, dispose() {} };

  const onData = (buf: Buffer): void => {
    // Only a lone ESC / Ctrl+C — multi-byte sequences (arrow keys) are ignored.
    if (buf.length === 1 && (buf[0] === 0x1b || buf[0] === 0x03)) controller.abort();
  };

  let active = false;
  const attach = (): void => {
    if (active) return;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
    active = true;
  };
  const detach = (): void => {
    if (!active) return;
    stdin.off("data", onData);
    stdin.setRawMode(false);
    stdin.pause();
    active = false;
  };

  attach();
  return { pause: detach, resume: attach, dispose: detach };
}
