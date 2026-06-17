import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runAgent } from "../src/core/agent/loop.js";
import { PermissionEngine } from "../src/core/permissions/modes.js";
import type { ResolvedAgent } from "../src/core/providers/registry.js";
import type { ChatResponse, Provider } from "../src/core/providers/types.js";

/** Provider that replays scripted assistant outputs, ignoring the request. */
class ScriptedProvider implements Provider {
  readonly name = "scripted";
  readonly model = "scripted";
  private i = 0;
  constructor(private readonly outputs: string[]) {}
  async chat(): Promise<ChatResponse> {
    const content = this.outputs[Math.min(this.i++, this.outputs.length - 1)]!;
    return { content, toolCalls: [], finishReason: "stop" };
  }
}

function makeAgent(outputs: string[]): ResolvedAgent {
  return {
    config: { name: "t", provider: "ollama", model: "m", toolMode: "emulated" },
    provider: new ScriptedProvider(outputs),
    toolMode: "emulated",
  };
}

const dirs: string[] = [];
function workspace(): string {
  const d = mkdtempSync(join(tmpdir(), "polypus-loop-"));
  dirs.push(d);
  return d;
}
function engine(ws: string) {
  return new PermissionEngine({
    mode: "bypass",
    policy: { workspace: ws, allow: ["**/*"], deny: [] },
    allowedCommands: [],
  });
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

describe("runAgent (emulated path)", () => {
  it("applies a write_file tool call and finishes", async () => {
    const ws = workspace();
    const agent = makeAgent([
      `<polypus:tool name="write_file">
<arg name="path">hello.txt</arg>
<arg name="content">olá mundo</arg>
</polypus:tool>`,
      `<polypus:tool name="finish"><arg name="summary">created hello.txt</arg></polypus:tool>`,
    ]);

    const result = await runAgent({
      task: "create hello.txt",
      workspace: ws,
      agent,
      permissions: engine(ws),
      promptContext: { workspace: ws, mode: "bypass", allow: ["**/*"] },
    });

    expect(result.finished).toBe(true);
    expect(result.summary).toBe("created hello.txt");
    expect(existsSync(join(ws, "hello.txt"))).toBe(true);
    expect(readFileSync(join(ws, "hello.txt"), "utf8")).toBe("olá mundo");
  });

  it("re-prompts when the model emits no tool call, then finishes", async () => {
    const ws = workspace();
    const agent = makeAgent([
      "I cannot create files, sorry.",
      `<polypus:tool name="finish"><arg name="summary">ok</arg></polypus:tool>`,
    ]);

    let reprompts = 0;
    const result = await runAgent({
      task: "do it",
      workspace: ws,
      agent,
      permissions: engine(ws),
      promptContext: { workspace: ws, mode: "bypass", allow: ["**/*"] },
      events: { onReprompt: () => reprompts++ },
    });

    expect(reprompts).toBe(1);
    expect(result.finished).toBe(true);
  });

  it("treats a conversational reply as a reply, without re-prompting", async () => {
    const ws = workspace();
    const agent = makeAgent(["Oi! Como posso ajudar você hoje?"]);

    let reprompts = 0;
    const result = await runAgent({
      task: "oi",
      workspace: ws,
      agent,
      permissions: engine(ws),
      promptContext: { workspace: ws, mode: "bypass", allow: ["**/*"] },
      events: { onReprompt: () => reprompts++ },
    });

    expect(reprompts).toBe(0);
    expect(result.reason).toBe("reply");
    expect(result.finished).toBe(false);
  });

  it("stops after repeated identical tool failures instead of looping", async () => {
    const ws = workspace();
    // write_file with no 'content' arg → always fails validation.
    const agent = makeAgent([
      `<polypus:tool name="write_file"><arg name="path">x.txt</arg></polypus:tool>`,
    ]);

    const result = await runAgent({
      task: "write x",
      workspace: ws,
      agent,
      permissions: engine(ws),
      promptContext: { workspace: ws, mode: "bypass", allow: ["**/*"] },
      maxSteps: 30,
    });

    expect(result.reason).toBe("stalled");
    expect(result.steps).toBe(3); // default maxToolRetries
  });

  it("appends auto-correction guidance to a failed tool result", async () => {
    const ws = workspace();
    // write_file with no 'content' arg → fails validation with arg guidance.
    const agent = makeAgent([
      `<polypus:tool name="write_file"><arg name="path">x.txt</arg></polypus:tool>`,
    ]);

    let corrections = 0;
    const result = await runAgent({
      task: "write x",
      workspace: ws,
      agent,
      permissions: engine(ws),
      promptContext: { workspace: ws, mode: "bypass", allow: ["**/*"] },
      events: { onCorrection: () => corrections++ },
    });

    expect(corrections).toBeGreaterThan(0);
    expect(result.messages.some((m) => m.content.includes("AUTO-CORRECTION"))).toBe(true);
  });

  it("leaves the raw error untouched when autoCorrect is disabled", async () => {
    const ws = workspace();
    const agent = makeAgent([
      `<polypus:tool name="write_file"><arg name="path">x.txt</arg></polypus:tool>`,
    ]);

    const result = await runAgent({
      task: "write x",
      workspace: ws,
      agent,
      permissions: engine(ws),
      promptContext: { workspace: ws, mode: "bypass", allow: ["**/*"] },
      autoCorrect: false,
    });

    expect(result.messages.some((m) => m.content.includes("AUTO-CORRECTION"))).toBe(false);
  });

  it("returns cancelled when the abort signal fires", async () => {
    const ws = workspace();
    const agent = makeAgent([`<polypus:tool name="finish"><arg name="summary">x</arg></polypus:tool>`]);
    const ac = new AbortController();
    ac.abort();

    const result = await runAgent({
      task: "do something",
      workspace: ws,
      agent,
      permissions: engine(ws),
      promptContext: { workspace: ws, mode: "bypass", allow: ["**/*"] },
      signal: ac.signal,
    });

    expect(result.reason).toBe("cancelled");
    expect(result.finished).toBe(false);
  });

  it("blocks writes in plan mode", async () => {
    const ws = workspace();
    const agent = makeAgent([
      `<polypus:tool name="write_file"><arg name="path">x.txt</arg><arg name="content">y</arg></polypus:tool>`,
      `<polypus:tool name="finish"><arg name="summary">tried</arg></polypus:tool>`,
    ]);

    const planEngine = new PermissionEngine({
      mode: "plan",
      policy: { workspace: ws, allow: ["**/*"], deny: [] },
      allowedCommands: [],
    });

    await runAgent({
      task: "write x",
      workspace: ws,
      agent,
      permissions: planEngine,
      promptContext: { workspace: ws, mode: "plan", allow: ["**/*"] },
    });

    expect(existsSync(join(ws, "x.txt"))).toBe(false);
  });
});
