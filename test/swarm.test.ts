import { mkdtempSync, existsSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runSwarm } from "../src/core/agent/orchestrator.js";
import type { ResolvedAgent } from "../src/core/providers/registry.js";
import type { ChatRequest, ChatResponse, Provider } from "../src/core/providers/types.js";

/**
 * Content-aware fake provider: answers the decomposition prompt with two
 * non-conflicting subtasks, and as a worker writes the file named in its brief,
 * then finishes. Stateless so it is safe under parallel worker execution.
 */
class SwarmFakeProvider implements Provider {
  readonly name = "fake";
  readonly model = "fake";
  async chat(req: ChatRequest): Promise<ChatResponse> {
    const text = req.messages.map((m) => m.content).join("\n");
    if (text.includes("splitting a coding task")) {
      const arr = JSON.stringify([
        { title: "A", brief: "create file fileA.txt with content AAA" },
        { title: "B", brief: "create file fileB.txt with content BBB" },
      ]);
      return { content: `Here you go:\n${arr}`, toolCalls: [], finishReason: "stop" };
    }
    if (text.includes("polypus:tool_result")) {
      return {
        content: `<polypus:tool name="finish"><arg name="summary">done</arg></polypus:tool>`,
        toolCalls: [],
        finishReason: "stop",
      };
    }
    const m = /create file (\S+) with content (\S+)/.exec(text);
    const path = m?.[1] ?? "out.txt";
    const content = m?.[2] ?? "x";
    return {
      content: `<polypus:tool name="write_file"><arg name="path">${path}</arg><arg name="content">${content}</arg></polypus:tool>`,
      toolCalls: [],
      finishReason: "stop",
    };
  }
}

function agent(name: string): ResolvedAgent {
  return {
    config: { name, provider: "ollama", model: "m", toolMode: "emulated" },
    provider: new SwarmFakeProvider(),
    toolMode: "emulated",
  };
}

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

describe("runSwarm", () => {
  it("decomposes, runs workers in parallel worktrees, and merges cleanly", async () => {
    const ws = mkdtempSync(join(tmpdir(), "polypus-swarm-"));
    dirs.push(ws);

    const result = await runSwarm({
      task: "create two files",
      workspace: ws,
      agents: [agent("a1"), agent("a2")],
      allow: ["**/*"],
      deny: [],
    });

    expect(result.subtasks).toHaveLength(2);
    expect(result.outcomes.every((o) => o.finished)).toBe(true);
    expect(result.merges.every((m) => m.ok)).toBe(true);

    // Both files were merged into the workspace's main branch.
    expect(existsSync(join(ws, "fileA.txt"))).toBe(true);
    expect(existsSync(join(ws, "fileB.txt"))).toBe(true);
    expect(readFileSync(join(ws, "fileA.txt"), "utf8")).toBe("AAA");
    expect(readFileSync(join(ws, "fileB.txt"), "utf8")).toBe("BBB");
  });
});
