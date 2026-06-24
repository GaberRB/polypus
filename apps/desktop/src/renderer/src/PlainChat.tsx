import { useState, type KeyboardEvent } from "react";
import { useSettings } from "./settings";
import type { ChatMessage } from "../../shared/ipc";

/** Plain conversation (Chat tab) — no tools, no project. Uses window.polypus.chat. */
export function PlainChat(): JSX.Element {
  const { t } = useSettings();
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async (): Promise<void> => {
    const text = input.trim();
    if (!text || busy) return;
    const next: ChatMessage[] = [...history, { role: "user", content: text }];
    setHistory(next);
    setInput("");
    setBusy(true);
    const res = await window.polypus?.chat(next);
    setBusy(false);
    const reply: ChatMessage = !res
      ? { role: "assistant", content: t("chat.bridgeUnavailable") }
      : res.ok
        ? { role: "assistant", content: res.data }
        : { role: "assistant", content: "⚠ " + res.error };
    setHistory((h) => [...h, reply]);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="chat">
      <div className="thread">
        {history.length === 0 && <p className="empty">{t("chat.empty")}</p>}
        {history.map((m, i) => (
          <div key={i} className={`msg msg-${m.role === "user" ? "user" : "agent"}`}>
            <pre className="msg-text">{m.content}</pre>
          </div>
        ))}
        {busy && <div className="msg msg-agent"><span className="muted">⠹ {t("chat.running")}</span></div>}
      </div>
      <div className="composer">
        <textarea
          className="composer-input"
          placeholder={t("chat.placeholder")}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          disabled={busy}
          rows={2}
        />
      </div>
    </div>
  );
}
