import { describe, expect, it } from "vitest";
import { createStreamAsk } from "../src/cli/commands/stream-ask.js";

describe("createStreamAsk", () => {
  it("emits an ask_user event and resolves when the matching response arrives", async () => {
    const out: Array<Record<string, unknown>> = [];
    const s = createStreamAsk((e) => out.push(e as Record<string, unknown>));

    const answer = s.ask({ question: "Pick one", options: ["A", "B"], multi: true });

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: "ask_user", id: 1, question: "Pick one", options: ["A", "B"], multi: true });

    s.handleLine(JSON.stringify({ type: "ask_response", id: 1, selected: ["A", "B"] }));
    await expect(answer).resolves.toEqual(["A", "B"]);
  });

  it("resolves to null when the user dismisses (selected: null)", async () => {
    const s = createStreamAsk(() => {});
    const answer = s.ask({ question: "Pick", options: ["X", "Y"] });
    s.handleLine(JSON.stringify({ type: "ask_response", id: 1, selected: null }));
    await expect(answer).resolves.toBeNull();
  });

  it("correlates concurrent questions by id and ignores noise / unknown ids", async () => {
    const s = createStreamAsk(() => {});
    const first = s.ask({ question: "Q1", options: ["a", "b"] });
    const second = s.ask({ question: "Q2", options: ["c", "d"] });

    s.handleLine("not json");
    s.handleLine(JSON.stringify({ type: "ask_response", id: 99, selected: ["z"] })); // unknown id
    s.handleLine(JSON.stringify({ type: "ask_response", id: 2, selected: ["d"] }));
    s.handleLine(JSON.stringify({ type: "ask_response", id: 1, selected: ["a"] }));

    await expect(first).resolves.toEqual(["a"]);
    await expect(second).resolves.toEqual(["d"]);
  });

  it("dispose() resolves every pending question to null", async () => {
    const s = createStreamAsk(() => {});
    const pending = s.ask({ question: "Q", options: ["a", "b"] });
    s.dispose();
    await expect(pending).resolves.toBeNull();
  });
});
