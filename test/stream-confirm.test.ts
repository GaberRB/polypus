import { describe, expect, it } from "vitest";
import { createStreamConfirm } from "../src/cli/commands/stream-confirm.js";
import type { Hunk } from "../src/core/permissions/diff.js";

describe("createStreamConfirm", () => {
  it("emits a confirm_request and resolves with the host's approval", async () => {
    const out: Array<Record<string, unknown>> = [];
    const s = createStreamConfirm((e) => out.push(e as Record<string, unknown>));

    const decision = s.confirm({ kind: "command", summary: "run: ls" });

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: "confirm_request", id: 1, kind: "command", summary: "run: ls" });

    s.handleLine(JSON.stringify({ type: "confirm_response", id: 1, approved: true }));
    await expect(decision).resolves.toBe(true);
  });

  it("renders write hunks as a unified diff in the event", async () => {
    const out: Array<Record<string, unknown>> = [];
    const s = createStreamConfirm((e) => out.push(e as Record<string, unknown>));

    const hunks: Hunk[] = [
      { oldStart: 0, oldCount: 0, newStart: 0, newCount: 1, lines: [{ type: "+", text: 'console.log("hi");' }] },
    ];
    void s.confirm({ kind: "write", summary: "write a.ts", hunks });

    expect(String(out[0]!.diff)).toContain("@@ -1,0 +1,1 @@");
    expect(String(out[0]!.diff)).toContain('+console.log("hi");');
  });

  it("rejects when the host disapproves, and dispose() denies anything pending", async () => {
    const s = createStreamConfirm(() => {});
    const rejected = s.confirm({ kind: "write", summary: "w" });
    s.handleLine(JSON.stringify({ type: "confirm_response", id: 1, approved: false }));
    await expect(rejected).resolves.toBe(false);

    const pending = s.confirm({ kind: "command", summary: "c" });
    s.dispose();
    await expect(pending).resolves.toBe(false);
  });
});
