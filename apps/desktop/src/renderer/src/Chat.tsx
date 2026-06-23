import { useRef, useState, type KeyboardEvent } from "react";
import { useSettings } from "./settings";
import type { Mode, Result, RunResult } from "../../shared/ipc";

interface Msg {
  id: number;
  role: "user" | "agent" | "error";
  text: string;
}

/**
 * Chat/execução pane (#115). Sends a task to the agent through the bridge
 * (`window.polypus.run`) in the selected permission mode (#116) and renders the
 * outcome legibly. Live token streaming and the per-step timeline land once a
 * streaming bridge exists; for now the final structured result is shown.
 */
export function Chat({ mode }: { mode: Mode }): JSX.Element {
  const { t } = useSettings();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const nextId = useRef(1);

  const push = (role: Msg["role"], text: string): void =>
    setMessages((m) => [...m, { id: nextId.current++, role, text }]);

  const send = async (): Promise<void> => {
    const task = input.trim();
    if (!task || running) return;
    push("user", task);
    setInput("");
    setRunning(true);
    try {
      const res: Result<RunResult> | undefined = await window.polypus?.run(task, mode);
      if (!res) {
        push("error", t("chat.bridgeUnavailable"));
      } else if (!res.ok) {
        push("error", res.error);
      } else {
        const r = res.data.result;
        push(
          "agent",
          r
            ? `✓ ${r.reason} · ${r.steps} passo(s)` +
                (r.filesChanged?.length ? `\nArquivos: ${r.filesChanged.join(", ")}` : "")
            : "Concluído (sem resultado estruturado).",
        );
      }
    } finally {
      setRunning(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    // Enter envia; Shift+Enter quebra linha.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="chat">
      <div className="thread">
        {messages.length === 0 && <p className="empty">{t("chat.empty")}</p>}
        {messages.map((m) => (
          <div key={m.id} className={`msg msg-${m.role}`}>
            <pre className="msg-text">{m.text}</pre>
          </div>
        ))}
        {running && (
          <div className="msg msg-agent">
            <span className="muted">⠹ {t("chat.running")}</span>
          </div>
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
