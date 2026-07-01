import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  captureCheckpoint,
  listCheckpoints,
  pruneCheckpoints,
  restoreToCheckpoint,
} from "../src/core/agent/checkpoints.js";

let home: string;
let ws: string;
const SID = "sess-1";

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "polypus-ckpt-home-"));
  ws = mkdtempSync(join(tmpdir(), "polypus-ckpt-ws-"));
  process.env.POLYPUS_HOME = home;
});
afterEach(() => {
  delete process.env.POLYPUS_HOME;
  for (const d of [home, ws]) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

function write(rel: string, content: string): void {
  writeFileSync(join(ws, rel), content);
}
function read(rel: string): string {
  return readFileSync(join(ws, rel), "utf8");
}

describe("captureCheckpoint + restoreToCheckpoint", () => {
  it("restores a modified file to its pre-edit content", async () => {
    write("a.ts", "AAA");
    await captureCheckpoint(ws, SID, "edit_file", 1, ["a.ts"]);
    write("a.ts", "BBB");

    const res = await restoreToCheckpoint(ws, SID, 1);
    expect(res.restored).toEqual(["a.ts"]);
    expect(read("a.ts")).toBe("AAA");
  });

  it("deletes a file that did not exist before the captured edit", async () => {
    // File absent at capture time → hash null → restore removes it.
    await captureCheckpoint(ws, SID, "write_file", 1, ["new.ts"]);
    write("new.ts", "created by agent");

    const res = await restoreToCheckpoint(ws, SID, 1);
    expect(res.deleted).toEqual(["new.ts"]);
    expect(existsSync(join(ws, "new.ts"))).toBe(false);
  });

  it("restores to the earliest pre-state across multiple checkpoints", async () => {
    write("f.ts", "v1");
    await captureCheckpoint(ws, SID, "edit_file", 1, ["f.ts"]);
    write("f.ts", "v2");
    await captureCheckpoint(ws, SID, "edit_file", 2, ["f.ts"]);
    write("f.ts", "v3");

    await restoreToCheckpoint(ws, SID, 1);
    expect(read("f.ts")).toBe("v1"); // earliest, not v2
  });

  it("makes a delete reversible", async () => {
    write("gone.ts", "keep me");
    await captureCheckpoint(ws, SID, "delete_file", 1, ["gone.ts"]);
    rmSync(join(ws, "gone.ts"));

    await restoreToCheckpoint(ws, SID, 1);
    expect(read("gone.ts")).toBe("keep me");
  });

  it("limits the restore to a single file when asked", async () => {
    write("a.ts", "A0");
    write("b.ts", "B0");
    await captureCheckpoint(ws, SID, "edit_file", 1, ["a.ts", "b.ts"]);
    write("a.ts", "A1");
    write("b.ts", "B1");

    await restoreToCheckpoint(ws, SID, 1, { file: "b.ts" });
    expect(read("a.ts")).toBe("A1"); // untouched
    expect(read("b.ts")).toBe("B0"); // restored
  });

  it("assigns increasing indices and lists them", async () => {
    write("a.ts", "1");
    await captureCheckpoint(ws, SID, "edit_file", 1, ["a.ts"]);
    write("a.ts", "2");
    await captureCheckpoint(ws, SID, "edit_file", 2, ["a.ts"]);

    const cps = await listCheckpoints(SID);
    expect(cps.map((c) => c.index)).toEqual([1, 2]);
  });
});

describe("pruneCheckpoints", () => {
  it("drops sessions whose newest checkpoint is older than the cutoff", async () => {
    write("a.ts", "x");
    await captureCheckpoint(ws, SID, "edit_file", 1, ["a.ts"]);
    expect((await listCheckpoints(SID)).length).toBe(1);

    await pruneCheckpoints(-1); // cutoff in the future → everything is "old"
    expect((await listCheckpoints(SID)).length).toBe(0);
  });

  it("keeps recent checkpoints", async () => {
    write("a.ts", "x");
    await captureCheckpoint(ws, SID, "edit_file", 1, ["a.ts"]);
    await pruneCheckpoints(7);
    expect((await listCheckpoints(SID)).length).toBe(1);
  });
});
