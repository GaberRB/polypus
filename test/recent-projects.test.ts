import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addRecentProject,
  listRecentProjects,
  removeRecentProject,
} from "../src/core/config/recent-projects.js";

let home: string;
let savedHome: string | undefined;

beforeEach(() => {
  savedHome = process.env.POLYPUS_HOME;
  home = mkdtempSync(join(tmpdir(), "polypus-recent-"));
  process.env.POLYPUS_HOME = home; // configDir() resolves here
});
afterEach(() => {
  if (savedHome === undefined) delete process.env.POLYPUS_HOME;
  else process.env.POLYPUS_HOME = savedHome;
  try {
    rmSync(home, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe("recent projects", () => {
  it("returns an empty list when nothing is stored", async () => {
    expect(await listRecentProjects()).toEqual([]);
  });

  it("adds, dedupes by path, and keeps the newest first", async () => {
    await addRecentProject("/a");
    await addRecentProject("/b");
    await addRecentProject("/a"); // re-adding moves it back to the front
    expect((await listRecentProjects()).map((p) => p.path)).toEqual(["/a", "/b"]);
  });

  it("caps the list at 20 entries", async () => {
    for (let i = 0; i < 25; i++) await addRecentProject(`/p${i}`);
    const list = await listRecentProjects();
    expect(list).toHaveLength(20);
    expect(list[0]!.path).toBe("/p24");
  });

  it("removes a project", async () => {
    await addRecentProject("/x");
    await addRecentProject("/y");
    await removeRecentProject("/x");
    expect((await listRecentProjects()).map((p) => p.path)).toEqual(["/y"]);
  });
});
