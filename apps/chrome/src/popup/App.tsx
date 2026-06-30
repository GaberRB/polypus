/** Popup App — controle rápido do Polypus */
import { useState, useEffect, useCallback } from "react";
import { t, getLocale, setLocale, type Locale } from "../shared/i18n.js";
import type { ConnectionStatus, UiToBg, BgToUi } from "../shared/types.js";

const STATUS_COLORS: Record<ConnectionStatus, string> = {
  connected: "#4ade80",
  connecting: "#fbbf24",
  disconnected: "#9ca3af",
  error: "#ef4444",
};

export function App() {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [task, setTask] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [canResume, setCanResume] = useState(false);
  const [locale, setLocaleState] = useState<Locale>(getLocale());

  // Listen for status updates from background
  useEffect(() => {
    const handler = (msg: unknown) => {
      const m = msg as BgToUi;
      if (m.type === "status") setStatus(m.status);
      if (m.type === "session") setSessionId(m.sessionId);
    };
    chrome.runtime.onMessage.addListener(handler);
    // Request initial status
    chrome.runtime.sendMessage({ type: "get_status" } as UiToBg, (resp) => {
      const r = resp as { status: ConnectionStatus; sessionId: string | null; canResume: boolean } | undefined;
      if (r) {
        setStatus(r.status);
        setSessionId(r.sessionId);
        setCanResume(r.canResume);
      }
    });
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  const handleSend = useCallback(() => {
    if (!task.trim()) return;
    chrome.runtime.sendMessage({ type: "run", task: task.trim(), mode: "review" } as UiToBg);
    setTask("");
  }, [task]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const toggleLocale = useCallback(() => {
    const next: Locale = locale === "pt-BR" ? "en" : "pt-BR";
    setLocale(next);
    setLocaleState(next);
  }, [locale]);

  return (
    <div style={{ width: 320, padding: 12, fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 24 }}>🐙</span>
        <span style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>Polypus</span>
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            backgroundColor: STATUS_COLORS[status],
            boxShadow: `0 0 6px ${STATUS_COLORS[status]}`,
            display: "inline-block",
          }}
          title={t(`popup.status.${status}`)}
        />
        <button
          onClick={toggleLocale}
          style={{ background: "none", border: "1px solid #555", borderRadius: 4, color: "#ccc", cursor: "pointer", fontSize: 11, padding: "2px 6px" }}
        >
          {locale === "pt-BR" ? "EN" : "PT"}
        </button>
      </div>

      {/* Status text */}
      <div style={{ fontSize: 12, color: "#aaa", marginBottom: 10 }}>
        {t(`popup.status.${status}`)}{sessionId ? ` · ${sessionId.slice(-6)}` : ""}
      </div>

      {/* No CLI warning */}
      {status === "disconnected" || status === "error" ? (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            backgroundColor: "rgba(239,68,68,.12)",
            border: "1px solid rgba(239,68,68,.3)",
            fontSize: 12,
            color: "#fca5a5",
            marginBottom: 10,
          }}
        >
          {t("popup.noCli")}
        </div>
      ) : null}

      {/* Task input */}
      <textarea
        value={task}
        onChange={(e) => setTask(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("popup.taskPlaceholder")}
        rows={3}
        style={{
          width: "100%",
          padding: 8,
          borderRadius: 8,
          border: "1px solid #444",
          backgroundColor: "#16213e",
          color: "#e0e0e0",
          fontFamily: "inherit",
          fontSize: 13,
          resize: "none",
          boxSizing: "border-box",
          marginBottom: 8,
        }}
      />

      {/* Buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button
          onClick={handleSend}
          disabled={!task.trim() || status !== "connected"}
          style={{
            flex: 1,
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            backgroundColor: status === "connected" ? "#7A4ADE" : "#444",
            color: "#fff",
            fontWeight: 600,
            cursor: status === "connected" ? "pointer" : "not-allowed",
            fontSize: 13,
          }}
        >
          {t("popup.send")}
        </button>
      </div>

      {/* Resume button when session exists */}
      {canResume && status !== "connecting" && status !== "connected" ? (
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button
            onClick={() => {
              chrome.runtime.sendMessage({ type: "run", task: "", mode: "review" } as UiToBg);
            }}
            style={{
              flex: 1,
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid #fbbf24",
              backgroundColor: "rgba(251,191,36,.12)",
              color: "#fbbf24",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            🔄 {t("popup.resume")}
          </button>
        </div>
      ) : null}

      {/* Open side panel */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => chrome.sidePanel?.open?.()}
          style={{
            flex: 1,
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid #555",
            backgroundColor: "transparent",
            color: "#ccc",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          {t("popup.openPanel")}
        </button>
      </div>
    </div>
  );
}