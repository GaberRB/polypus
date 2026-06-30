import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runSwarm } from "../src/core/agent/orchestrator.js";
import type { ResolvedAgent } from "../src/core/providers/registry.js";
import type { ChatRequest, ChatResponse, Provider } from "../src/core/providers/types.js";

/** Splits into two subtasks (A, B); as a worker, writes the file in its brief. */
class GoodProvider implements Provider {
  readonly name = "good";
  readonly model = "good";
  async chat(req: ChatRequest): Promise<ChatResponse> {
    const text = req.messages.map((m) => m.content).join("\n");
    if (text.includes("splitting a coding task")) {
      const arr = JSON.stringify([
        { title: "A", brief: "create file fileA.txt with content AAA" },
        { title: "B", brief: "create file fileB.txt with content BBB" },
      ]);
      return { content: arr, toolCalls: [], finishReason: "stop" };
    }
    if (text.includes("polypus:tool_result")) {
      return { content: `<polypus:tool name="finish"><arg name="summary">done</arg></polypus:tool>`, toolCalls: [], finishReason: "stop" };
    }
    const m = /create file (\S+) with content (\S+)/.exec(text);
    return {
      content: `<polypus:tool name="write_file"><arg name="path">${m?.[1] ?? "out.txt"}</arg><arg name="content">${m?.[2] ?? "x"}</arg></polypus:tool>`,
      toolCalls: [],
      finishReason: "stop",
    };
  }
}

/** Throws on worker calls (never asked to decompose in these tests). */
class ThrowingProvider implements Provider {
  readonly name = "throwing";
  readonly model = "throwing";
  async chat(): Promise<ChatResponse> {
    throw new Error("provider boom");
  }
}

/** Never resolves on its own — only rejects when the request signal aborts. */
class HangingProvider implements Provider {
  readonly name = "hanging";
  readonly model = "hanging";
  chat(req: ChatRequest): Promise<ChatResponse> {
    return new Promise((_resolve, reject) => {
      req.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    });
  }
}

function agentOf(name: string, provider: Provider): ResolvedAgent {
  return {
    config: { name, provider: "ollama", model: "m", toolMode: "emulated" },
    provider,
    toolMode: "emulated",
  };
}

const dirs: string[] = [];
function ws(): string {
  const d = mkdtempSync(join(tmpdir(), "polypus-swarm-rel-"));
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

describe("swarm reliability", () => {
  it("merges the workers that succeeded even when one fails", async () => {
    const workspace = ws();
    const result = await runSwarm({
      task: "two files",
      workspace,
      agents: [agentOf("a1", new GoodProvider()), agentOf("a2", new ThrowingProvider())],
      allow: ["**/*"],
      deny: [],
    });

    // a1 → t1 (fileA) committed & merged; a2 → t2 threw → unfinished, nothing merged.
    expect(result.outcomes.some((o) => o.finished && o.committed)).toBe(true);
    expect(result.outcomes.some((o) => !o.finished)).toBe(true);
    expect(result.merges.every((m) => m.ok)).toBe(true);
    expect(existsSync(join(workspace, "fileA.txt"))).toBe(true);
    expect(existsSync(join(workspace, "fileB.txt"))).toBe(false);
  });

  it("does no work and merges nothing when the signal is already aborted", async () => {
    const workspace = ws();
    const result = await runSwarm({
      task: "two files",
      workspace,
      agents: [agentOf("a1", new GoodProvider()), agentOf("a2", new GoodProvider())],
      allow: ["**/*"],
      deny: [],
      signal: AbortSignal.abort(),
    });

    expect(result.outcomes.every((o) => !o.finished && !o.committed)).toBe(true);
    expect(result.merges).toHaveLength(0);
    expect(existsSync(join(workspace, "fileA.txt"))).toBe(false);
  });

  it("aborts a stalled worker on the idle timeout without hanging the run", async () => {
    const workspace = ws();
    const result = await runSwarm({
      task: "two files",
      workspace,
      agents: [agentOf("a1", new GoodProvider()), agentOf("a2", new HangingProvider())],
      allow: ["**/*"],
      deny: [],
      idleTimeoutMs: 40,
    });

    // a1 finishes and merges; a2 hangs → idle-aborted → unfinished. Run still completes.
    expect(existsSync(join(workspace, "fileA.txt"))).toBe(true);
    expect(result.outcomes.some((o) => !o.finished)).toBe(true);
  }, 60_000);
});
