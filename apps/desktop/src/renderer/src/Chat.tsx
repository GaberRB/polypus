import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useSettings } from "./settings";
import type { Mode, StreamEvent } from "../../shared/ipc";

interface ToolItem {
  name: string;
  arg?: string;
  ok?: boolean;
  output?: string;
}

type Msg =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "agent"; text: string; tools: ToolItem[]; done: boolean }
  | { id: number; role: "error"; text: string };

function deriveArg(args: unknown): string | undefined {
  if (!args || typeof args !== "object") return undefined;
  const a = args as Record<string, unknown>;
  const v = a.command ?? a.path ?? a.query;
  return typeof v === "string" ? v : undefined;
}

/**
 * Chat/execução pane (#115). Streams the run live via `window.polypus.runStream`:
 * a timeline of tool calls plus the agent's text as it arrives (no garbling — the
 * #110 class of bug can't happen in the renderer). Diffs with per-hunk approval
 * are #116.
 */
export function Chat({ mode }: { mode: Mode }): JSX.Element {
  const { t } = useSettings();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const nextId = useRef(1);
  const unsubRef = useRef<(() => void) | null>(null);

  // Detach the stream listener on unmount.
  useEffect(() => () => unsubRef.current?.(), []);

  /** Update the in-flight agent message immutably. */
  const patchAgent = (id: number, fn: (m: Extract<Msg, { role: "agent" }>) => Extract<Msg, { role: "agent" }>): void =>
    setMessages((prev) => prev.map((m) => (m.id === id && m.role === "agent" ? fn(m) : m)));

  const handle = (agentId: number, ev: StreamEvent): void => {
    switch (ev.type) {
      case "assistant_delta":
        patchAgent(agentId, (m) => ({ ...m, text: m.text + String(ev.text ?? "") }));
        break;
      case "assistant":
        patchAgent(agentId, (m) => (m.text ? m : { ...m, text: String(ev.text ?? "") }));
        break;
      case "tool_call":
        patchAgent(agentId, (m) => ({
          ...m,
          tools: [...m.tools, { name: String(ev.name ?? "tool"), arg: deriveArg(ev.arguments) }],
        }));
        break;
      case "tool_result":
        patchAgent(agentId, (m) => {
          const tools = [...m.tools];
          for (let i = tools.length - 1; i >= 0; i--) {
            if (tools[i]!.ok === undefined) {
              tools[i] = { ...tools[i]!, ok: Boolean(ev.ok), output: String(ev.output ?? "") };
              break;
            }
          }
          return { ...m, tools };
        });
        break;
      case "result":
        patchAgent(agentId, (m) => ({ ...m, done: true }));
        break;
      case "error":
        setMessages((prev) => [...prev, { id: nextId.current++, role: "error", text: String(ev.message ?? "erro") }]);
        break;
      case "end":
        unsubRef.current?.();
        unsubRef.current = null;
        setRunning(false);
        break;
    }
  };

  const send = (): void => {
    const task = input.trim();
    if (!task || running) return;
    const userId = nextId.current++;
    const agentId = nextId.current++;
    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", text: task },
      { id: agentId, role: "agent", text: "", tools: [], done: false },
    ]);
    setInput("");
    setRunning(true);

    if (!window.polypus?.runStream) {
      handle(agentId, { type: "error", message: t("chat.bridgeUnavailable") });
      setRunning(false);
      return;
    }
    unsubRef.current = window.polypus.runStream(task, mode, (ev) => handle(agentId, ev));
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="chat">
      <div className="thread">
        {messages.length === 0 && <p className="empty">{t("chat.empty")}</p>}
        {messages.map((m) =>
          m.role === "agent" ? (
            <div key={m.id} className="msg msg-agent">
              {m.tools.length > 0 && (
                <div className="timeline">
                  {m.tools.map((tool, i) => (
                    <div className="tool" key={i}>
                      <span className="tool-head">
                        <span className="tool-status">
                          {tool.ok === undefined ? "⠹" : tool.ok ? "✓" : "✗"}
                        </span>
                        <span className="tool-name">{tool.name}</span>
                        {tool.arg && <span className="muted tool-arg">{tool.arg}</span>}
                      </span>
                      {tool.output && <div className="tool-out muted">{tool.output.split("\n")[0]}</div>}
                    </div>
                  ))}
                </div>
              )}
              {m.text && <pre className="msg-text">{m.text}</pre>}
              {!m.done && !m.text && m.tools.length === 0 && (
                <span className="muted">⠹ {t("chat.running")}</span>
              )}
            </div>
          ) : (
            <div key={m.id} className={`msg msg-${m.role}`}>
              <pre className="msg-text">{m.text}</pre>
            </div>
          ),
        )}
      </div>

      <div className="composer">
        <textarea
          className="composer-input"
          placeholder={t("chat.placeholder")}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          disabled={running}
          rows={2}
        />
      </div>
    </div>
  );
}
