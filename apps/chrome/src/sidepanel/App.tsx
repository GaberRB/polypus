/** Side Panel App — chat completo com streaming e timeline */
import { useState, useEffect, useCallback, useRef } from "react";
import { t, getLocale, setLocale, type Locale } from "../shared/i18n.js";
import {
  type ConnectionStatus,
  type StreamEvent,
  type WebAction,
  type WebPermissions,
  type BgToUi,
  type UiToBg,
} from "../shared/types.js";
import { defaultPermissions, isUrlAllowed, isActionAllowed } from "../shared/permissions.js";
import { ChatView } from "./ChatView.js";
import { Timeline } from "./Timeline.js";
import { ConfirmCard } from "./ConfirmCard.js";
import { PermissionBar } from "./PermissionBar.js";
import { UsageBar } from "./UsageBar.js";

export function App() {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [task, setTask] = useState("");
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [actions, setActions] = useState<WebAction[]>([]);
  const [permissions, setPermissions] = useState<WebPermissions>(defaultPermissions());
  const [pendingConfirm, setPendingConfirm] = useState<{
    id: number;
    action: string;
    target?: string;
    summary: string;
  } | null>(null);
  const [pendingAsk, setPendingAsk] = useState<{
    id: number;
    question: string;
    options: string[];
    multi?: boolean;
  } | null>(null);
  const [locale, setLocaleState] = useState<Locale>(getLocale());
  const eventsEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new events arrive
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  // Listen for events from background
  useEffect(() => {
    const handler = (msg: unknown) => {
      const m = msg as BgToUi;
      switch (m.type) {
        case "status":
          setStatus(m.status);
          break;
        case "session":
          setSessionId(m.sessionId);
          break;
        case "event":
          setEvents((prev) => [...prev, m.event]);
          // Track confirm requests
          if (m.event.type === "confirm_request") {
            setPendingConfirm({
              id: m.event.id,
              action: m.event.action,
              target: m.event.target,
              summary: m.event.summary,
            });
          }
          if (m.event.type === "ask_user") {
            setPendingAsk({
              id: m.event.id,
              question: m.event.question,
              options: m.event.options,
              multi: m.event.multi,
            });
          }
          // Track tool calls as actions
          if (m.event.type === "tool_call") {
            setActions((prev) => [
              ...prev,
              {
                id: m.event.id,
                tool: m.event.tool as any,
                args: m.event.args,
                status: "running",
                timestamp: Date.now(),
              },
            ]);
          }
          if (m.event.type === "tool_result") {
            setActions((prev) =>
              prev.map((a) =>
                a.id === m.event.id
                  ? { ...a, status: m.event.ok ? "done" : "error", result: m.event.output, error: m.event.ok ? undefined : m.event.output }
                  : a,
              ),
            );
          }
          break;
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    chrome.runtime.sendMessage({ type: "get_status" } as UiToBg);
    // Load permissions from storage
    chrome.storage.sync.get("polypusPermissions", (data: any) => {
      if (data?.polypusPermissions) setPermissions(data.polypusPermissions);
    });
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  const handleSend = useCallback(() => {
    if (!task.trim() || status !== "connected") return;
    if (!isActionAllowed("web_navigate", permissions.mode)) {
      // Just inform — the agent itself enforces, but let's be transparent
    }
    chrome.runtime.sendMessage({ type: "run", task: task.trim(), mode: permissions.mode } as UiToBg);
    setEvents((prev) => [
      ...prev,
      { type: "step", step: prev.filter((e) => e.type === "step").length + 1 },
      ...(prev.length === 0
        ? [{ type: "assistant_delta" as const, text: `▶ ${t("panel.running", { tool: permissions.mode })}` }]
        : []),
    ]);
    setTask("");
  }, [task, status, permissions.mode]);

  const handleStop = useCallback(() => {
    chrome.runtime.sendMessage({ type: "stop" } as UiToBg);
  }, []);

  const handleConfirm = useCallback(
    (approved: boolean) => {
      if (!pendingConfirm) return;
      chrome.runtime.sendMessage({
        type: "respond_confirm",
        id: pendingConfirm.id,
        approved,
      } as UiToBg);
      setPendingConfirm(null);
    },
    [pendingConfirm],
  );

  const handleAsk = useCallback(
    (selected: string[] | null) => {
      if (!pendingAsk) return;
      chrome.runtime.sendMessage({
        type: "respond_ask",
        id: pendingAsk.id,
        selected,
      } as UiToBg);
      setPendingAsk(null);
    },
    [pendingAsk],
  );

  const handlePermissionsChange = useCallback((p: WebPermissions) => {
    setPermissions(p);
    chrome.storage.sync.set({ polypusPermissions: p });
  }, []);

  const toggleLocale = useCallback(() => {
    const next: Locale = locale === "pt-BR" ? "en" : "pt-BR";
    setLocale(next);
    setLocaleState(next);
  }, [locale]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: "#1a1a2e",
        color: "#e0e0e0",
        fontFamily: "system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          borderBottom: "1px solid #333",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 20 }}>🐙</span>
        <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>Polypus</span>
        <span style={{ fontSize: 11, color: "#888" }}>
          {status === "connected" ? "🟢" : status === "connecting" ? "🟡" : "⚫"}
        </span>
        <button
          onClick={toggleLocale}
          style={{ background: "none", border: "1px solid #555", borderRadius: 4, color: "#ccc", cursor: "pointer", fontSize: 10, padding: "2px 5px" }}
        >
          {locale === "pt-BR" ? "EN" : "PT"}
        </button>
        {sessionId && (
          <span style={{ fontSize: 10, color: "#666" }}>#{sessionId.slice(-6)}</span>
        )}
      </div>

      {/* Permission bar */}
      <PermissionBar permissions={permissions} onChange={handlePermissionsChange} />

      {/* Main content area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Chat messages */}
        <ChatView events={events} />
        <div ref={eventsEndRef} />

        {/* Pending confirm card */}
        {pendingConfirm && (
          <ConfirmCard
            action={pendingConfirm.action}
            target={pendingConfirm.target}
            summary={pendingConfirm.summary}
            onApprove={() => handleConfirm(true)}
            onReject={() => handleConfirm(false)}
          />
        )}

        {/* Pending ask card */}
        {pendingAsk && (
          <div style={{ padding: "8px 12px", borderTop: "1px solid #333", backgroundColor: "#16213e" }}>
            <p style={{ fontSize: 13, marginBottom: 8 }}>{pendingAsk.question}</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {pendingAsk.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleAsk([opt])}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: "1px solid #7A4ADE",
                    backgroundColor: "transparent",
                    color: "#cdb6fd",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  {opt}
                </button>
              ))}
              <button
                onClick={() => handleAsk(null)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: "1px solid #555",
                  backgroundColor: "transparent",
                  color: "#999",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      <Timeline actions={actions} />

      {/* Usage bar */}
      <UsageBar events={events} />

      {/* Input area */}
      <div
        style={{
          padding: "8px 12px",
          borderTop: "1px solid #333",
          display: "flex",
          gap: 8,
          flexShrink: 0,
          backgroundColor: "#16213e",
        }}
      >
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder={t("panel.placeholder")}
          rows={2}
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 8,
            border: "1px solid #444",
            backgroundColor: "#1a1a2e",
            color: "#e0e0e0",
            fontFamily: "inherit",
            fontSize: 13,
            resize: "none",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button
            onClick={handleSend}
            disabled={!task.trim() || status !== "connected"}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "none",
              backgroundColor: status === "connected" ? "#7A4ADE" : "#444",
              color: "#fff",
              fontWeight: 600,
              cursor: status === "connected" ? "pointer" : "not-allowed",
              fontSize: 12,
            }}
          >
            {t("panel.send")}
          </button>
          <button
            onClick={handleStop}
            style={{
              padding: "4px 10px",
              borderRadius: 8,
              border: "1px solid #555",
              backgroundColor: "transparent",
              color: "#ccc",
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            {t("panel.stop")}
          </button>
        </div>
      </div>
    </div>
  );
}