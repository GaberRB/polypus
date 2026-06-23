import { useRef, useState, type KeyboardEvent } from "react";
import type { Result, RunResult } from "../../shared/ipc";

interface Msg {
  id: number;
  role: "user" | "agent" | "error";
  text: string;
}

/**
 * Chat/execução pane (#115). Sends a task to the agent through the bridge
 * (`window.polypus.run`) and renders the outcome legibly. Live token streaming
 * and the per-step timeline land once a streaming bridge exists; for now the
 * final structured result is shown.
 */
export function Chat(): JSX.Element {
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
      const res: Result<RunResult> | undefined = await window.polypus?.run(task);
      if (!res) {
        push("error", "Ponte indisponível (window.polypus). Rode pelo Electron.");
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
        {messages.length === 0 && (
          <p className="empty">Digite uma tarefa para o agente começar.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`msg msg-${m.role}`}>
            <pre className="msg-text">{m.text}</pre>
          </div>
        ))}
        {running && (
          <div className="msg msg-agent">
            <span className="muted">⠹ executando…</span>
          </div>
        )}
      </div>

      <div className="composer">
        <textarea
          className="composer-input"
          placeholder="digite uma tarefa…  (Enter envia · Shift+Enter nova linha · @arquivo p/ contexto)"
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
