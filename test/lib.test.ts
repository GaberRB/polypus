import { describe, expect, it } from "vitest";
import * as lib from "../src/lib.js";

describe("library surface (@gaberrb/polypus/lib)", () => {
  it("re-exports the embedder-facing core APIs as callables", () => {
    const fns = [
      "addRecentProject",
      "listRecentProjects",
      "removeRecentProject",
      "gitInfo",
      "listSessions",
      "loadSession",
      "latestSession",
      "loadConfig",
      "configDir",
      "testConnection",
    ];
    for (const name of fns) {
      expect(typeof (lib as Record<string, unknown>)[name]).toBe("function");
    }
  });
});
