/** ChatView — renderiza mensagens do agente com streaming de texto */
import { useEffect, useRef } from "react";
import type { StreamEvent } from "../shared/types.js";

interface Props {
  events: StreamEvent[];
}

export function ChatView({ events }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const textEvents = events.filter(
    (e): e is StreamEvent & { type: "assistant_delta" } => e.type === "assistant_delta",
  );
  const lastText = textEvents[textEvents.length - 1]?.text ?? "";

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
      {events.length === 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: "#666",
            fontSize: 14,
            textAlign: "center",
            whiteSpace: "pre-wrap",
          }}
        >
          {text}
        </div>
      )}

      {events.map((ev, i) => {
        switch (ev.type) {
          case "assistant_delta":
            return (
              <div
                key={i}
                style={{
                  marginBottom: 8,
                  padding: "8px 12px",
                  borderRadius: 10,
                  backgroundColor: "#1e1e3a",
                  border: "1px solid #333",
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: "#cdb6fd",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {ev.text}
              </div>
            );
          case "tool_call":
            return (
              <div
                key={i}
                style={{
                  marginBottom: 4,
                  padding: "4px 8px",
                  borderRadius: 6,
                  backgroundColor: "rgba(122,74,222,.1)",
                  fontSize: 12,
                  color: "#aaa",
                }}
              >
                → {ev.tool}
                {ev.args.url ? ` ${ev.args.url}` : ev.args.selector ? ` ${ev.args.selector}` : ""}
              </div>
            );
          case "tool_result":
            return (
              <div
                key={i}
                style={{
                  marginBottom: 4,
                  padding: "4px 8px",
                  borderRadius: 6,
                  fontSize: 12,
                  color: ev.ok ? "#4ade80" : "#ef4444",
                }}
              >
                {ev.ok ? "✓" : "✗"} {ev.output.slice(0, 120)}
              </div>
            );
          case "error":
            return (
              <div
                key={i}
                style={{
                  marginBottom: 8,
                  padding: "8px 12px",
                  borderRadius: 10,
                  backgroundColor: "rgba(239,68,68,.1)",
                  border: "1px solid rgba(239,68,68,.3)",
                  fontSize: 13,
                  color: "#fca5a5",
                }}
              >
                ✗ {ev.message}
              </div>
            );
          case "end":
            return (
              <div
                key={i}
                style={{
                  marginBottom: 8,
                  padding: "6px 12px",
                  borderRadius: 8,
                  backgroundColor: "rgba(74,222,128,.08)",
                  fontSize: 12,
                  color: "#4ade80",
                }}
              >
                ✓ Done (code {ev.code ?? 0})
              </div>
            );
          default:
            return null;
        }
      })}
      <div ref={endRef} />
    </div>
  );
}

const text = `Ask the agent to do something on this page.

Examples:
  "Extract all links and save as CSV"
  "Find how to use the API"
  "Create an issue describing this bug"

The agent will navigate, extract, scroll, and interact with pages.`;