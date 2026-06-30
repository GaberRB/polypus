/**
 * Host-agnostic chat pane. Driven entirely by a `ChatTransport` (T2) and the
 * pure `reduce` (T3): the desktop app and the VSCode extension both mount this
 * with their own transport. No Electron, no VSCode, no `window.*` here.
 */
import { useEffect, useReducer, useRef, useState, type KeyboardEvent } from "react";
import type { ChatTransport, FileEntry, ModelPrice, Mode, RunControls, StreamEvent } from "../transport.js";
import {
  hasPendingAsk,
  initialState,
  lockAsk,
  reduce,
  type ChatState,
  type Msg,
} from "../reducer.js";
import { DiffViewer, isDiff } from "./DiffViewer.js";
import { ChoiceCard } from "./ChoiceCard.js";
import { UsageBar } from "./UsageBar.js";
import { ControlsBar, MODE_META } from "./ControlsBar.js";
import { PolypusMascot } from "./PolypusMascot.js";
import { ThinkingBlock } from "./ThinkingBlock.js";

export interface ChatLabels {
  placeholder: string;
  empty: string;
  noProject: string;
  running: string;
  cancel: string;
  rateLimited: string;
  shiftTabHint: string;
}

const DEFAULT_LABELS: ChatLabels = {
  placeholder: "Descreva a tarefa…  (@ para citar arquivos)",
  empty: "Envie uma tarefa para começar.",
  noProject: "Abra uma pasta para começar.",
  running: "Polypus está trabalhando…",
  cancel: "Cancelar",
  rateLimited:
    "Limite de requisições atingido no modelo atual. Tente o modo rápido (fast) ou troque para um modelo pago barato.",
  shiftTabHint: "Pressione Shift+Tab para aprovar edições automaticamente",
};

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

/** Heuristic: is this an error event from a provider rate-limit? */
function isRateLimit(ev: StreamEvent): boolean {
  const msg = String(ev.message ?? ev.text ?? "").toLowerCase();
  return /rate.?limit|429|too many requests|quota/.test(msg);
}

/**
 * Control + stream actions. Message creation (`send`) and card-locking
 * (`lockAsk`) are kept out of the pure stream `reduce` so that reducer stays a
 * faithful mirror of the CLI's event contract.
 */
type Action =
  | { kind: "send"; userId: number; agentId: number; text: string }
  | { kind: "stream"; agentId: number; ev: StreamEvent }
  | { kind: "lockAsk"; agentId: number; askId: number; selected: string[] }
  | { kind: "clear" }
  | { kind: "rewind"; keepUserTurns: number; newSessionId: string };

function chatReducer(state: ChatState, action: Action, nextErrorId: () => number): ChatState {
  switch (action.kind) {
    case "clear":
      // Drop the thread and the session id so the next run starts fresh.
      return { messages: [], usage: { promptTokens: 0, completionTokens: 0 }, sessionId: undefined, running: false };
    case "rewind": {
      // Truncate the thread to the first `keepUserTurns` user turns and point at
      // the forked session so the next send resumes from there.
      let userSeen = 0;
      const kept: Msg[] = [];
      for (const m of state.messages) {
        if (m.role === "user") {
          if (userSeen >= action.keepUserTurns) break;
          userSeen++;
        }
        kept.push(m);
      }
      return { ...state, messages: kept, sessionId: action.newSessionId, running: false };
    }
    case "send":
      return {
        ...state,
        running: true,
        messages: [
          ...state.messages,
          { id: action.userId, role: "user", text: action.text },
          { id: action.agentId, role: "agent", text: "", thinking: "", tools: [], asks: [], done: false },
        ],
      };
    case "stream":
      return reduce(state, action.agentId, action.ev, nextErrorId);
    case "lockAsk":
      return { ...state, messages: lockAsk(state.messages, action.agentId, action.askId, action.selected) };
  }
}

export function Chat({
  transport,
  mode = "review",
  hasProject = true,
  seed,
  labels: labelOverrides,
}: {
  transport: ChatTransport;
  mode?: Mode;
  hasProject?: boolean;
  seed?: { messages?: Msg[]; sessionId?: string };
  labels?: Partial<ChatLabels>;
}): JSX.Element {
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };
  const errorIdRef = useRef(-1);
  const nextErrorId = (): number => errorIdRef.current--;

  // Run controls (mode/agent/profile) — surfaced by the ControlsBar (VA2-4).
  const [controls, setControls] = useState<RunControls>({ mode });
  const controlsRef = useRef(controls);
  controlsRef.current = controls;

  const [state, dispatch] = useReducer(
    (s: ChatState, a: Action) => chatReducer(s, a, nextErrorId),
    undefined,
    () => initialState(seed),
  );

  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [price, setPrice] = useState<ModelPrice | null>(null);
  const [rateLimited, setRateLimited] = useState(false);

  // @-mention file picker (VA6).
  const [atFiles, setAtFiles] = useState<FileEntry[]>([]);
  const [atQuery, setAtQuery] = useState("");
  const [showAtPicker, setShowAtPicker] = useState(false);

  const nextId = useRef(1);
  const unsubRef = useRef<(() => void) | null>(null);
  const sendingRef = useRef(false);

  useEffect(() => () => unsubRef.current?.(), []);
  useEffect(() => {
    void transport.getModelPrice().then(setPrice).catch(() => setPrice(null));
  }, [transport]);

  const send = (): void => {
    const task = input.trim();
    if (!task || sendingRef.current || running || !hasProject) return;
    sendingRef.current = true;
    setRateLimited(false);

    const userId = nextId.current;
    const agentId = nextId.current + 1;
    nextId.current += 2;

    setInput("");
    setRunning(true);

    const onEvent = (ev: StreamEvent): void => {
      if (ev.type === "error" && isRateLimit(ev)) setRateLimited(true);
      if (ev.type === "end") {
        unsubRef.current?.();
        unsubRef.current = null;
        setRunning(false);
      }
      dispatch({ kind: "stream", agentId, ev });
    };

    const startRun = (finalTask: string): void => {
      dispatch({ kind: "send", userId, agentId, text: finalTask });
      unsubRef.current = transport.runStream(finalTask, controlsRef.current, onEvent, {
        resumeSessionId: state.sessionId,
      });
      sendingRef.current = false;
    };

    if (typeof transport.getEditorSelection === "function") {
      void transport.getEditorSelection().then((sel) => {
        if (sel && typeof sel.file === "string" && typeof sel.text === "string") {
          const prefix = `[Selected in ${sel.file}]\n\`\`\`\n${sel.text}\n\`\`\`\n\n`;
          startRun(prefix + task);
        } else {
          startRun(task);
        }
      }).catch(() => startRun(task));
    } else {
      startRun(task);
    }
  };

  const answerAsk = (agentId: number, askId: number, selected: string[]): void => {
    transport.respondAsk(askId, selected);
    dispatch({ kind: "lockAsk", agentId, askId, selected }); // lock the card optimistically
  };

  const cancel = (): void => {
    unsubRef.current?.();
    unsubRef.current = null;
    transport.stopRun();
    setRunning(false);
  };

  /** Shift+Tab toggles between "ask before edits" and "edit automatically". */
  const toggleAutoApprove = (): void => {
    setControls((c) => ({ ...c, mode: c.mode === "bypass" ? "review" : "bypass" }));
  };

  const clearConversation = (): void => {
    cancel();
    dispatch({ kind: "clear" });
  };

  /** Rewind to (and including the chance to redo) a prior user turn. */
  const rewindTo = async (userMsgId: number): Promise<void> => {
    if (!state.sessionId || running) return;
    // How many user turns precede this one — that's what we keep.
    let keep = 0;
    for (const m of state.messages) {
      if (m.id === userMsgId) break;
      if (m.role === "user") keep++;
    }
    const newId = await transport.rewind(state.sessionId, keep);
    if (newId) dispatch({ kind: "rewind", keepUserTurns: keep, newSessionId: newId });
  };

  /** Detect a trailing `@query` and surface the file picker (VA6). */
  const onInputChange = (value: string): void => {
    setInput(value);
    const match = /@(\S*)$/.exec(value);
    if (match) {
      const q = match[1] ?? "";
      setAtQuery(q);
      setShowAtPicker(true);
      void transport.listFiles(q).then(setAtFiles).catch(() => setAtFiles([]));
    } else {
      setShowAtPicker(false);
    }
  };

  /** Replace the trailing `@query` with a path reference — agent reads when needed. */
  const selectAtFile = (file: FileEntry): void => {
    setShowAtPicker(false);
    const ref = `@[${file.name}](${file.path})`;
    setInput((prev) => prev.replace(/@\S*$/, ref));
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (showAtPicker && e.key === "Escape") {
      e.preventDefault();
      setShowAtPicker(false);
      return;
    }
    if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      toggleAutoApprove();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const filteredAtFiles = atFiles
    .filter((f) => !atQuery || f.name.toLowerCase().includes(atQuery.toLowerCase()))
    .slice(0, 12);

  const pendingAsk = hasPendingAsk(state.messages);
  const modeMeta = MODE_META[controls.mode];

  return (
    <div className="chat">
      <div className="thread" aria-live="polite" aria-atomic="false">
        {!hasProject && <p className="empty">{labels.noProject}</p>}
        {hasProject && state.messages.length === 0 && (
          <div className="welcome">
            <PolypusMascot size="lg" state="idle" />
            <p className="empty">{labels.empty}</p>
            <p className="shift-tab-banner">{labels.shiftTabHint}</p>
          </div>
        )}
        {state.messages.map((m) =>
          m.role === "agent" ? (
            <div key={m.id} className="msg msg-agent">
              <ThinkingBlock text={m.thinking} running={!m.done} />
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
                      {tool.output &&
                        (isDiff(tool.output) ? (
                          <DiffViewer diff={tool.output} />
                        ) : (
                          <div className="tool-out muted">{tool.output.split("\n")[0]}</div>
                        ))}
                    </div>
                  ))}
                </div>
              )}
              {m.text && <pre className="msg-text">{m.text}</pre>}
              {m.asks.map((ask) => (
                <ChoiceCard key={ask.id} prompt={ask} onSubmit={(sel) => answerAsk(m.id, ask.id, sel)} />
              ))}
              {!m.done && !m.text && m.tools.length === 0 && m.asks.length === 0 && (
                <div className="thinking-state">
                  <span className="spinner-dot" aria-hidden />
                  <span>{labels.running}</span>
                </div>
              )}
            </div>
          ) : (
            <div key={m.id} className={`msg msg-${m.role}`}>
              <pre className="msg-text">{m.text}</pre>
              {m.role === "user" && state.sessionId && !running && (
                <button
                  className="rewind-btn"
                  title="Voltar para este ponto (cria uma sessão derivada)"
                  aria-label="Rewind para aqui"
                  onClick={() => void rewindTo(m.id)}
                >
                  ↺
                </button>
              )}
            </div>
          ),
        )}
        {rateLimited && <div className="rate-limit-note" role="alert">{labels.rateLimited}</div>}
      </div>

      <UsageBar
        promptTokens={state.usage.promptTokens}
        completionTokens={state.usage.completionTokens}
        price={price}
      />

      <ControlsBar
        controls={controls}
        onChange={setControls}
        transport={transport}
        onClear={clearConversation}
        disabled={running && !pendingAsk}
      />

      <div className="composer" style={{ position: "relative" }}>
        {showAtPicker && filteredAtFiles.length > 0 && (
          <div className="at-picker">
            {filteredAtFiles.map((f) => (
              <button
                key={f.path}
                className="at-picker-item"
                onMouseDown={(e) => {
                  e.preventDefault();
                  void selectAtFile(f);
                }}
              >
                <span className="at-picker-icon" aria-hidden>·</span>
                {f.name}
              </button>
            ))}
          </div>
        )}
        <div className="composer-row">
          <textarea
            className="composer-input"
            placeholder={labels.placeholder}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKey}
            disabled={(running && !pendingAsk) || !hasProject}
            rows={2}
          />
          {running && (
            <button className="stop-btn" title={labels.cancel} onClick={cancel}>
              ■
            </button>
          )}
        </div>
        {/* Active-mode indicator (RF3), bottom-right of the composer. */}
        <div className="mode-indicator" title={modeMeta.hint}>
          <span aria-hidden>{modeMeta.icon}</span>
          <span>{modeMeta.label}</span>
        </div>
      </div>
    </div>
  );
}
