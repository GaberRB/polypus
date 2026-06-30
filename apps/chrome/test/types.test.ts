/**
 * Tests for shared types — basic structural validation.
 *
 * These are type-level contracts; we validate that the runtime values
 * we produce match the expected shapes. This avoids regressions when
 * refactoring the NDJSON protocol.
 */
import { describe, expect, it } from "vitest";
import type {
  ConnectionStatus,
  PermissionMode,
  WebActionName,
  WebAction,
  StreamEvent,
  WsCommand,
  BgToUi,
  UiToBg,
  WebPermissions,
  AppState,
} from "../src/shared/types.js";

/* ─── Enum-like types ─── */

describe("ConnectionStatus", () => {
  it("accepts all expected values", () => {
    const s: ConnectionStatus[] = ["disconnected", "connecting", "connected", "error"];
    // just a structural check — is the array of valid values assignable?
    expect(s).toHaveLength(4);
  });
});

describe("PermissionMode", () => {
  it("accepts all three modes", () => {
    const m: PermissionMode[] = ["plan", "review", "bypass"];
    expect(m).toHaveLength(3);
  });
});

describe("WebActionName", () => {
  it("contains all 9 bridge tools", () => {
    const names: WebActionName[] = [
      "web_navigate", "web_click", "web_type",
      "web_extract", "web_scroll", "web_screenshot",
      "web_get_html", "web_wait", "web_execute",
    ];
    expect(names).toHaveLength(9);
  });
});

/* ─── WebAction ─── */

describe("WebAction", () => {
  it("can hold a pending navigate action", () => {
    const act: WebAction = {
      id: "act-1",
      tool: "web_navigate",
      args: { url: "https://example.com" },
      status: "pending",
      target: "https://example.com",
      timestamp: Date.now(),
    };
    expect(act.id).toBe("act-1");
    expect(act.args.url).toBe("https://example.com");
  });

  it("can hold a done click action", () => {
    const act: WebAction = {
      id: "act-2",
      tool: "web_click",
      args: { selector: "#login-btn" },
      status: "done",
      result: "✓ Clicked",
      timestamp: Date.now(),
    };
    expect(act.tool).toBe("web_click");
    expect(act.status).toBe("done");
  });

  it("can hold an error action", () => {
    const act: WebAction = {
      id: "act-3",
      tool: "web_type",
      args: { selector: "#input", text: "hello" },
      status: "error",
      error: "Element not found",
      timestamp: Date.now(),
    };
    expect(act.status).toBe("error");
    expect(act.error).toBeTruthy();
  });
});

/* ─── StreamEvent (NDJSON protocol) ─── */

describe("StreamEvent", () => {
  it("session_start has sessionId", () => {
    const ev: StreamEvent = { type: "session_start", sessionId: "abc-123" };
    expect(ev.sessionId).toBe("abc-123");
  });

  it("tool_call has id and args", () => {
    const ev: StreamEvent = {
      type: "tool_call",
      tool: "web_navigate",
      args: { url: "https://example.com" },
      id: "call-1",
    };
    expect(ev.tool).toBe("web_navigate");
  });

  it("ask_user has question and options", () => {
    const ev: StreamEvent = {
      type: "ask_user",
      id: 1,
      question: "Which task?",
      options: ["A", "B"],
    };
    expect(ev.options).toHaveLength(2);
  });

  it("confirm_request has action details", () => {
    const ev: StreamEvent = {
      type: "confirm_request",
      id: 2,
      action: "web_click",
      target: "#btn",
      summary: "Click the submit button",
    };
    expect(ev.approved).toBeUndefined();
    // approved só aparece na resposta
  });

  it("end event can carry exit code", () => {
    const ev: StreamEvent = { type: "end", code: 0 };
    expect(ev.code).toBe(0);
  });
});

/* ─── WsCommand (UI → CLI) ─── */

describe("WsCommand", () => {
  it("run command carries task and optional mode", () => {
    const msg: WsCommand = { type: "run", task: "fix bug", mode: "review" };
    expect(msg.task).toBeTruthy();
  });

  it("respond_ask carries selection", () => {
    const msg: WsCommand = { type: "respond_ask", id: 1, selected: ["A"] };
    expect(msg.selected).toEqual(["A"]);
  });

  it("respond_confirm carries approved flag", () => {
    const msg: WsCommand = { type: "respond_confirm", id: 2, approved: true };
    expect(msg.approved).toBe(true);
  });
});

/* ─── BgToUi e UiToBg ─── */

describe("BgToUi", () => {
  it("status update", () => {
    const m: BgToUi = { type: "status", status: "connected" };
    expect(m.status).toBe("connected");
  });

  it("session update", () => {
    const m: BgToUi = { type: "session", sessionId: "s-1" };
    expect(m.sessionId).toBe("s-1");
  });
});

describe("UiToBg", () => {
  it("get_status expects sync response", () => {
    const m: UiToBg = { type: "get_status" };
    expect(m.type).toBe("get_status");
  });

  it("stop command", () => {
    const m: UiToBg = { type: "stop" };
    expect(m.type).toBe("stop");
  });
});

/* ─── WebPermissions & AppState ─── */

describe("WebPermissions", () => {
  it("holds mode and lists", () => {
    const p: WebPermissions = {
      mode: "review",
      allowList: ["github.com"],
      blockList: ["bank.com"],
    };
    expect(p.allowList).toContain("github.com");
  });
});

describe("AppState", () => {
  it("holds runtime state", () => {
    const s: AppState = {
      status: "disconnected",
      sessionId: null,
      actions: [],
      events: [],
      permissions: { mode: "review", allowList: [], blockList: [] },
    };
    expect(s.status).toBe("disconnected");
    expect(s.actions).toEqual([]);
  });
});