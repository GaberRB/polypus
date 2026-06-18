import { describe, expect, it } from "vitest";
import { SwarmView, describeToolCall } from "../src/ui/swarm-view.js";
import type { ToolCall } from "../src/core/providers/types.js";
import type { WorkerOutcome } from "../src/core/agent/worker.js";

const call = (name: string, args: Record<string, unknown>): ToolCall => ({ id: "1", name, arguments: args });

function view() {
  // tty:true exercises frameLines; color:false keeps assertions plain; sink swallows output.
  return new SwarmView("lead", { tty: true, color: false, sink: () => {} });
}

describe("describeToolCall", () => {
  it("summarizes path- and command-based calls", () => {
    expect(describeToolCall(call("read_file", { path: "src/index.ts" }))).toBe("read_file src/index.ts");
    expect(describeToolCall(call("run_command", { command: "npm test" }))).toBe("run_command npm test");
    expect(describeToolCall(call("list_dir", {}))).toBe("list_dir");
  });
  it("truncates a very long argument", () => {
    const out = describeToolCall(call("write_file", { path: "a/".repeat(60) }));
    expect(out.length).toBeLessThan(60);
    expect(out).toMatch(/…$/);
  });
});

describe("SwarmView", () => {
  it("renders the orchestrator header and one row per worker with live action", () => {
    const v = view();
    v.setSubtasks([
      { id: "t1", title: "server", brief: "" },
      { id: "t2", title: "client", brief: "" },
    ]);
    v.workerStart("t1", "a1");
    v.workerStart("t2", "a2");
    v.workerAction("t1", "read_file src/index.ts");
    v.workerStep("t1", 3);

    const text = v.frameLines().join("\n");
    expect(text).toContain("lead"); // orchestrator header
    expect(text).toContain("t1");
    expect(text).toContain("[a1]");
    expect(text).toContain("read_file src/index.ts");
    expect(text).toContain("t2");
    expect(text).toContain("[a2]");
  });

  it("marks a worker done with a check and keeps its step count", () => {
    const v = view();
    v.setSubtasks([{ id: "t1", title: "x", brief: "" }]);
    v.workerStart("t1", "a1");
    const outcome: WorkerOutcome = {
      subtask: { id: "t1", title: "x", brief: "" },
      agentName: "a1",
      branch: "polypus/t1",
      finished: true,
      committed: true,
      steps: 6,
    };
    v.workerDone(outcome);

    const text = v.frameLines().join("\n");
    expect(text).toContain("✓");
    expect(text).toMatch(/6/); // step count retained
  });
});
