import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deriveTitle,
  latestSession,
  listSessions,
  loadSession,
  newSessionId,
  saveSession,
} from "../src/core/agent/session-store.js";
import type { Message } from "../src/core/providers/types.js";

const base = {
  agentName: "a",
  mode: "review" as const,
};

describe("session-store", () => {
  let home: string;
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "polypus-sessions-"));
    process.env.POLYPUS_HOME = home;
  });
  afterEach(() => {
    delete process.env.POLYPUS_HOME;
    try {
      rmSync(home, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("saves and loads a session round-trip", async () => {
    const id = newSessionId();
    const messages: Message[] = [
      { role: "user", content: "do the thing" },
      { role: "assistant", content: "done" },
    ];
    await saveSession({ id, updatedAt: new Date().toISOString(), title: "t", ...base, messages });
    const loaded = await loadSession(id);
    expect(loaded?.id).toBe(id);
    expect(loaded?.messages).toHaveLength(2);
    expect(loaded?.messages[0]!.content).toBe("do the thing");
  });

  it("redacts secrets in saved message content", async () => {
    const id = newSessionId();
    const messages: Message[] = [{ role: "tool", content: "key=AKIAIOSFODNN7EXAMPLE here" }];
    await saveSession({ id, updatedAt: new Date().toISOString(), title: "t", ...base, messages });
    const loaded = await loadSession(id);
    expect(loaded?.messages[0]!.content).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(loaded?.messages[0]!.content).toContain("[redacted]");
  });

  it("lists sessions most-recent-first and finds the latest", async () => {
    await saveSession({ id: "2026-06-20T00-00-00-000Z-aaaa", updatedAt: "2026-06-20T00:00:00.000Z", title: "old", ...base, messages: [] });
    await saveSession({ id: "2026-06-21T00-00-00-000Z-bbbb", updatedAt: "2026-06-21T00:00:00.000Z", title: "new", ...base, messages: [{ role: "user", content: "x" }] });
    const list = await listSessions();
    expect(list[0]!.title).toBe("new");
    const latest = await latestSession();
    expect(latest?.title).toBe("new");
  });

  it("returns undefined for a missing session", async () => {
    expect(await loadSession("nope")).toBeUndefined();
  });

  it("derives a title from the first user message", () => {
    expect(deriveTitle([{ role: "system", content: "sys" }, { role: "user", content: "  build a   parser " }])).toBe(
      "build a parser",
    );
    expect(deriveTitle([])).toBe("(untitled)");
  });
});
