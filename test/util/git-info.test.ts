import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { gitInfo } from "../../src/core/util/git-info.js";

const dirs: string[] = [];
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "polypus-git-"));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

describe("gitInfo", () => {
  it("reports a real git repo with a branch and root", async () => {
    const d = tmp();
    execFileSync("git", ["init"], { cwd: d });
    execFileSync("git", ["config", "user.email", "t@t.dev"], { cwd: d });
    execFileSync("git", ["config", "user.name", "t"], { cwd: d });
    execFileSync("git", ["commit", "--allow-empty", "-m", "init"], { cwd: d });

    const info = await gitInfo(d);
    expect(info.isRepo).toBe(true);
    expect(info.branch && info.branch.length > 0).toBe(true);
    expect(typeof info.root).toBe("string");
  });

  it("returns isRepo:false on error (non-existent directory)", async () => {
    // A path that does not exist makes the git invocation fail deterministically,
    // regardless of any parent repository above the temp dir.
    const info = await gitInfo(join(tmp(), "nope-does-not-exist"));
    expect(info.isRepo).toBe(false);
  });
});
