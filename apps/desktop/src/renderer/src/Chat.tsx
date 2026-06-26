import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useSettings } from "./settings";
import { PolypusMascot } from "./PolypusMascot";
import { DiffViewer, isDiff } from "./DiffViewer";
import type { DirEntry, LoadedSession, Mode, ModelPrice, StreamEvent } from "../../shared/ipc";

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

const TOOL_ICONS: Record<string, string> = {
  write_file: "✎", edit_file: "✎", create_file: "✎",
  read_file: "◎", view_file: "◎",
  run_command: "⊡", execute: "⊡", bash: "⊡",
  search_file: "⊘", grep: "⊘", glob: "⊘",
  retrieve: "◈", finish: "✦",
};

function toolIcon(name: string): string {
  const key = Object.keys(TOOL_ICONS).find((k) => name.toLowerCase().includes(k));
  return key ? (TOOL_ICONS[key] ?? "◈") : "◈";
}

/**
 * Chat/execução pane (#115). Streams the run live via `window.polypus.runStream`:
 * a timeline of tool calls plus the agent's text as it arrives (no garbling — the
 * #110 class of bug can't happen in the renderer). Diffs with per-hunk approval
 * are #116.
 */
export function Chat({
  mode,
  dir,
  initialSession,
}: {
  mode: Mode;
  dir?: string;
  initialSession?: LoadedSession;
}): JSX.Element {
  const { t } = useSettings();
  const [messages, setMessages] = useState<Msg[]>(() => {
    if (!initialSession) return [];
    let id = 1;
    return initialSession.messages.flatMap((m): Msg[] => {
      const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      if (m.role === "user") return [{ id: id++, role: "user", text }];
      if (m.role === "assistant") return [{ id: id++, role: "agent", text, tools: [], done: true }];
      return [];
    });
  });
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [atFiles, setAtFiles] = useState<DirEntry[]>([]);
  const [atQuery, setAtQuery] = useState("");
  const [showAtPicker, setShowAtPicker] = useState(false);
  const [promptTokens, setPromptTokens] = useState(0);
  const [completionTokens, setCompletionTokens] = useState(0);
  const [modelPrice, setModelPrice] = useState<ModelPrice | null>(null);
  const nextId = useRef(initialSession ? initialSession.messages.length + 1 : 1);
  const unsubRef = useRef<(() => void) | null>(null);
  // Synchronous guard — prevents double-send when Enter is pressed twice before re-render.
  const sendingRef = useRef(false);
  // Session ID received from session_start event — used to resume on follow-ups.
  const sessionIdRef = useRef<string | undefined>(initialSession?.id);

  // Detach the stream listener on unmount.
  useEffect(() => () => unsubRef.current?.(), []);

  // Fetch model price once on mount for cost estimation.
  useEffect(() => {
    void window.polypus?.getModelPrice().then((res) => {
      if (res?.ok && res.data) setModelPrice(res.data);
    });
  }, []);

  /** Update the in-flight agent message immutably. */
  const patchAgent = (id: number, fn: (m: Extract<Msg, { role: "agent" }>) => Extract<Msg, { role: "agent" }>): void =>
    setMessages((prev) => prev.map((m) => (m.id === id && m.role === "agent" ? fn(m) : m)));

  const handle = (agentId: number, ev: StreamEvent): void => {
    switch (ev.type) {
      case "session_start":
        // Store session ID so the next send can resume this conversation.
        if (ev.sessionId) sessionIdRef.current = ev.sessionId;
        break;
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
      case "usage":
        // ev carries cumulative totals — overwrite (not add) each event.
        if (ev.promptTokens !== undefined) setPromptTokens(Number(ev.promptTokens));
        if (ev.completionTokens !== undefined) setCompletionTokens(Number(ev.completionTokens));
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
    if (!task || sendingRef.current || running || !dir) return;
    sendingRef.current = true;
    const userId = nextId.current++;
    const agentId = nextId.current++;
    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", text: task },
      { id: agentId, role: "agent", text: "", tools: [], done: false },
    ]);
    setInput("");
    setPromptTokens(0);
    setCompletionTokens(0);
    setRunning(true);

    if (!window.polypus?.runStream) {
      handle(agentId, { type: "error", message: t("chat.bridgeUnavailable") });
      setRunning(false);
      sendingRef.current = false;
      return;
    }
    unsubRef.current = window.polypus.runStream(task, mode, (ev) => handle(agentId, ev), dir, sessionIdRef.current);
    sendingRef.current = false;
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (showAtPicker) {
      if (e.key === "Escape") { e.preventDefault(); setShowAtPicker(false); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const val = e.target.value;
    setInput(val);
    const match = /@(\w*)$/.exec(val);
    if (match && dir) {
      const q = match[1] ?? "";
      setAtQuery(q);
      if (!showAtPicker) {
        void window.polypus?.dirList(dir).then((res) => {
          if (res?.ok) setAtFiles(res.data.filter((f) => f.type === "file"));
        });
        setShowAtPicker(true);
      }
    } else {
      setShowAtPicker(false);
      setAtQuery("");
    }
  };

  const selectAtFile = async (file: DirEntry): Promise<void> => {
    setShowAtPicker(false);
    const res = await window.polypus?.fileRead(file.path);
    if (!res?.ok) return;
    const block = `\`\`\`${file.name}\n${res.data}\n\`\`\``;
    setInput((prev) => prev.replace(/@\w*$/, block));
  };

  const filteredAtFiles = atFiles.filter((f) =>
    !atQuery || f.name.toLowerCase().includes(atQuery.toLowerCase()),
  );

  return (
    <div className="chat">
      <div className="thread" aria-live="polite" aria-atomic="false">
        {initialSession && messages.length > 0 && (
          <div className="muted" style={{ fontSize: "12px", textAlign: "center", padding: "8px 0 4px" }}>
            — sessão retomada: {initialSession.title} —
          </div>
        )}
        {!dir && (
          <p className="empty" style={{ textAlign: "center", padding: "24px 12px" }}>
            📁 {t("chat.noProject")}
          </p>
        )}
        {messages.length === 0 && dir && <p className="empty">{t("chat.empty")}</p>}
        {messages.map((m) =>
          m.role === "agent" ? (
            <div key={m.id} className="msg msg-agent">
              {m.tools.length > 0 && (
                <div className="timeline">
                  {m.tools.map((tool, i) => (
                    <div
                      className={`tool tool--${tool.ok === undefined ? "running" : tool.ok ? "ok" : "error"}`}
                      key={i}
                    >
                      <span className="tool-head">
                        <span className="tool-icon" aria-hidden>{toolIcon(tool.name)}</span>
                        <span className="tool-name">{tool.name}</span>
                        {tool.arg && <span className="muted tool-arg">{tool.arg}</span>}
                        <span
                          className="tool-status-dot"
                          role="status"
                          aria-label={tool.ok === undefined ? "executando" : tool.ok ? "concluído" : "erro"}
                        />
                      </span>
                      {tool.output && (
                        isDiff(tool.output)
                          ? <DiffViewer diff={tool.output} />
                          : <div className="tool-out muted">{tool.output.split("\n")[0]}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {m.text && <pre className="msg-text">{m.text}</pre>}
              {!m.done && !m.text && m.tools.length === 0 && (
                <div className="thinking-state">
                  <PolypusMascot size="lg" state="running" />
                  <span>{t("chat.running")}</span>
                </div>
              )}
            </div>
          ) : (
            <div key={m.id} className={`msg msg-${m.role}`}>
              <pre className="msg-text">{m.text}</pre>
            </div>
          ),
        )}
      </div>

      <UsageBar promptTokens={promptTokens} completionTokens={completionTokens} price={modelPrice} />

      <div className="composer" style={{ position: "relative" }}>
        {showAtPicker && filteredAtFiles.length > 0 && (
          <div className="at-picker">
            {filteredAtFiles.slice(0, 12).map((f) => (
              <button
                key={f.path}
                className="at-picker-item"
                onMouseDown={(e) => { e.preventDefault(); void selectAtFile(f); }}
              >
                <span className="at-picker-icon">·</span>
                {f.name}
              </button>
            ))}
          </div>
        )}
        {showAtPicker && filteredAtFiles.length === 0 && atQuery && (
          <div className="at-picker">
            <div className="at-picker-empty">Nenhum arquivo encontrado para "{atQuery}"</div>
          </div>
        )}
        <div className="composer-row">
          <textarea
            className="composer-input"
            placeholder={t("chat.placeholder")}
            value={input}
            onChange={onInputChange}
            onKeyDown={onKey}
            disabled={running || !dir}
            rows={2}
          />
          {running && (
            <button
              className="stop-btn"
              title="Cancelar"
              onClick={() => {
                unsubRef.current?.();
                unsubRef.current = null;
                window.polypus?.stopRun?.();
                setRunning(false);
              }}
            >
              ■
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function fmtTokens(n: number): string {
  if (n === 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtCost(usd: number): string {
  if (usd < 0.0001) return "<$0.0001";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

const DAY_KEY = "polypus.dayCost";
const DAY_DATE_KEY = "polypus.dayCostDate";

function addDayCost(usd: number): number {
  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem(DAY_DATE_KEY) !== today) {
    localStorage.setItem(DAY_DATE_KEY, today);
    localStorage.setItem(DAY_KEY, "0");
  }
  const prev = parseFloat(localStorage.getItem(DAY_KEY) ?? "0");
  const next = prev + usd;
  localStorage.setItem(DAY_KEY, String(next));
  return next;
}

function getDayCost(): number {
  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem(DAY_DATE_KEY) !== today) return 0;
  return parseFloat(localStorage.getItem(DAY_KEY) ?? "0");
}

function UsageBar({
  promptTokens,
  completionTokens,
  price,
}: {
  promptTokens: number;
  completionTokens: number;
  price: ModelPrice | null;
}): JSX.Element | null {
  const [expanded, setExpanded] = useState(false);
  const [dayCost, setDayCost] = useState(() => getDayCost());

  const total = promptTokens + completionTokens;
  if (total === 0) return null;

  const costUsd =
    price
      ? (promptTokens * price.promptPrice + completionTokens * price.completionPrice) / 1_000_000
      : null;
  const promptCost = price ? (promptTokens * price.promptPrice) / 1_000_000 : null;
  const completionCost = price ? (completionTokens * price.completionPrice) / 1_000_000 : null;

  // Update daily cost when this session's cost changes
  useEffect(() => {
    if (costUsd !== null && costUsd > 0) setDayCost(addDayCost(0));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="usage-bar">
      <span>↑ {fmtTokens(promptTokens)}</span>
      <span className="usage-sep">·</span>
      <span>↓ {fmtTokens(completionTokens)}</span>
      <span className="usage-sep">·</span>
      <span>{fmtTokens(total)} tokens</span>
      {costUsd !== null && (
        <>
          <span className="usage-sep">·</span>
          <span className="usage-cost">{fmtCost(costUsd)}</span>
        </>
      )}
      <button
        className="usage-expand-btn"
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? "Recolher detalhes" : "Expandir detalhes de custo"}
        aria-expanded={expanded}
      >
        {expanded ? "▴" : "▾"}
      </button>
      {expanded && (
        <div className="cost-panel">
          <div className="cost-panel-row">
            <span className="muted">Prompt</span>
            <span>{fmtTokens(promptTokens)} tok{promptCost !== null ? ` · ${fmtCost(promptCost)}` : ""}</span>
          </div>
          <div className="cost-panel-row">
            <span className="muted">Completion</span>
            <span>{fmtTokens(completionTokens)} tok{completionCost !== null ? ` · ${fmtCost(completionCost)}` : ""}</span>
          </div>
          {costUsd !== null && (
            <>
              <div className="cost-bar" aria-label={`Prompt: ${Math.round(promptTokens / total * 100)}%, Completion: ${Math.round(completionTokens / total * 100)}%`}>
                <div className="cost-bar-prompt" style={{ flex: promptTokens }} />
                <div className="cost-bar-completion" style={{ flex: completionTokens }} />
              </div>
              <div className="cost-panel-row cost-panel-today">
                <span className="muted">Hoje (acumulado)</span>
                <span>{fmtCost(dayCost + costUsd)}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
