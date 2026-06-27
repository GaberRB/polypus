/**
 * Host-agnostic chat pane. Driven entirely by a `ChatTransport` (T2) and the
 * pure `reduce` (T3): the desktop app and the VSCode extension both mount this
 * with their own transport. No Electron, no VSCode, no `window.*` here.
 */
import { useEffect, useReducer, useRef, useState, type KeyboardEvent } from "react";
import type { ChatTransport, ModelPrice, Mode, StreamEvent } from "../transport.js";
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

export interface ChatLabels {
  placeholder: string;
  empty: string;
  noProject: string;
  running: string;
  cancel: string;
  rateLimited: string;
}

const DEFAULT_LABELS: ChatLabels = {
  placeholder: "Descreva a tarefa…  (@ para citar arquivos)",
  empty: "Envie uma tarefa para começar.",
  noProject: "Abra uma pasta para começar.",
  running: "Polypus está trabalhando…",
  cancel: "Cancelar",
  rateLimited:
    "Limite de requisições atingido no modelo atual. Tente o modo rápido (fast) ou troque para um modelo pago barato.",
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
  | { kind: "lockAsk"; agentId: number; askId: number; selected: string[] };

function chatReducer(state: ChatState, action: Action, nextErrorId: () => number): ChatState {
  switch (action.kind) {
    case "send":
      return {
        ...state,
        running: true,
        messages: [
          ...state.messages,
          { id: action.userId, role: "user", text: action.text },
          { id: action.agentId, role: "agent", text: "", tools: [], asks: [], done: false },
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

  const [state, dispatch] = useReducer(
    (s: ChatState, a: Action) => chatReducer(s, a, nextErrorId),
    undefined,
    () => initialState(seed),
  );

  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [price, setPrice] = useState<ModelPrice | null>(null);
  const [rateLimited, setRateLimited] = useState(false);

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
    dispatch({ kind: "send", userId, agentId, text: task });

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

    unsubRef.current = transport.runStream(task, mode, onEvent, { resumeSessionId: state.sessionId });
    sendingRef.current = false;
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

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const pendingAsk = hasPendingAsk(state.messages);

  return (
    <div className="chat">
      <div className="thread" aria-live="polite" aria-atomic="false">
        {!hasProject && <p className="empty">{labels.noProject}</p>}
        {hasProject && state.messages.length === 0 && <p className="empty">{labels.empty}</p>}
        {state.messages.map((m) =>
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

      <div className="composer">
        <div className="composer-row">
          <textarea
            className="composer-input"
            placeholder={labels.placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
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
      </div>
    </div>
  );
}
