import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useSettings } from "./settings";
import { PolypusMascot } from "./PolypusMascot";
import type { Mode, ModelPrice, StreamEvent } from "../../shared/ipc";

interface ToolItem {
  name: string;
  arg?: string;
  ok?: boolean;
  output?: string;
}

interface RunSummary {
  files: number;
  steps: number;
  tokens: number;
}

type Phase = "idle" | "running" | "done";

function baseName(p: string): string {
  return p.replace(/[/\\]+$/, "").split(/[/\\]/).pop() || p;
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

function deriveArg(args: unknown): string | undefined {
  if (!args || typeof args !== "object") return undefined;
  const a = args as Record<string, unknown>;
  const v = a.command ?? a.path ?? a.query;
  return typeof v === "string" ? v : undefined;
}

export function Cowork({
  mode,
  dir,
  onPickProject,
}: {
  mode: Mode;
  dir: string | null;
  onPickProject: (p: string) => void;
}): JSX.Element {
  const { t } = useSettings();
  const [task, setTask] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [tools, setTools] = useState<ToolItem[]>([]);
  const [agentText, setAgentText] = useState("");
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [promptTokens, setPromptTokens] = useState(0);
  const [completionTokens, setCompletionTokens] = useState(0);
  const [modelPrice, setModelPrice] = useState<ModelPrice | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => unsubRef.current?.(), []);

  useEffect(() => {
    void window.polypus?.getModelPrice().then((res) => {
      if (res?.ok && res.data) setModelPrice(res.data);
    });
  }, []);

  // Scroll to bottom as new events arrive.
  useEffect(() => {
    if (phase === "running") {
      threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [tools, agentText, phase]);

  const handle = (ev: StreamEvent): void => {
    switch (ev.type) {
      case "assistant_delta":
        setAgentText((t) => t + String(ev.text ?? ""));
        break;
      case "assistant":
        setAgentText((t) => (t ? t : String(ev.text ?? "")));
        break;
      case "tool_call":
        setTools((prev) => [
          ...prev,
          { name: String(ev.name ?? "tool"), arg: deriveArg(ev.arguments) },
        ]);
        break;
      case "tool_result":
        setTools((prev) => {
          const next = [...prev];
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i]!.ok === undefined) {
              next[i] = { ...next[i]!, ok: Boolean(ev.ok), output: String(ev.output ?? "") };
              break;
            }
          }
          return next;
        });
        break;
      case "usage":
        // ev carries cumulative totals — overwrite each event.
        if (ev.promptTokens !== undefined) setPromptTokens(Number(ev.promptTokens));
        if (ev.completionTokens !== undefined) setCompletionTokens(Number(ev.completionTokens));
        break;
      case "result": {
        const r = ev as { steps?: number; filesChanged?: string[] };
        setSummary({
          files: r.filesChanged?.length ?? 0,
          steps: r.steps ?? 0,
          tokens: 0, // filled from totalTokens at end
        });
        break;
      }
      case "error":
        setError(String(ev.message ?? "erro desconhecido"));
        break;
      case "end":
        unsubRef.current?.();
        unsubRef.current = null;
        setPhase("done");
        break;
    }
  };

  const run = (): void => {
    if (!task.trim() || !dir || phase === "running") return;
    setPhase("running");
    setTools([]);
    setAgentText("");
    setError(null);
    setSummary(null);
    setPromptTokens(0);
    setCompletionTokens(0);

    if (!window.polypus?.runStream) {
      setError(t("chat.bridgeUnavailable"));
      setPhase("idle");
      return;
    }
    unsubRef.current = window.polypus.runStream(task, mode, handle, dir);
  };

  const chooseFolder = async (): Promise<void> => {
    const res = await window.polypus?.chooseFolder();
    if (res?.ok && res.data) onPickProject(res.data);
  };

  const reset = (): void => {
    setPhase("idle");
    setTask("");
    setTools([]);
    setAgentText("");
    setError(null);
    setSummary(null);
    setPromptTokens(0);
    setCompletionTokens(0);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      run();
    }
  };

  if (phase === "idle") {
    return (
      <div className="cowork-empty">
        <div className="cowork-icon" aria-hidden>🐙</div>
        <h2 className="cowork-heading">{t("cowork.prompt")}</h2>

        {!dir && (
          <p className="muted cowork-no-folder">{t("cowork.noFolder")}</p>
        )}

        <textarea
          className="cowork-input"
          placeholder={t("cowork.placeholder")}
          value={task}
          onChange={(e) => setTask(e.target.value)}
          onKeyDown={onKey}
          rows={4}
          disabled={!dir}
        />

        <div className="cowork-actions">
          {!dir ? (
            <button className="btn" onClick={chooseFolder}>
              📁 {t("cowork.chooseFolder")}
            </button>
          ) : (
            <span className="muted cowork-dir-label">
              📁 {baseName(dir)}
            </span>
          )}
          <button
            className="btn cowork-run-btn"
            onClick={run}
            disabled={!task.trim() || !dir}
          >
            ▶ {t("cowork.run")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cowork-run">
      <div className="cowork-task-bar">
        <span className="muted cowork-task-label">📁 {dir ? baseName(dir) : ""}</span>
        <span className="cowork-task-text">{task}</span>
      </div>

      <div className="thread cowork-thread" ref={threadRef}>
        {tools.length > 0 && (
          <div className="timeline">
            {tools.map((tool, i) => (
              <div className="tool" key={i}>
                <span className="tool-head">
                  <span className="tool-status">
                    {tool.ok === undefined
                      ? <PolypusMascot size="sm" />
                      : tool.ok ? "✓" : "✗"}
                  </span>
                  <span className="tool-name">{tool.name}</span>
                  {tool.arg && <span className="muted tool-arg">{tool.arg}</span>}
                </span>
                {tool.output && (
                  <div className="tool-out muted">{tool.output.split("\n")[0]}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {agentText && <pre className="msg-text cowork-agent-text">{agentText}</pre>}

        {phase === "running" && !agentText && tools.length === 0 && (
          <div className="thinking-state">
            <PolypusMascot size="lg" />
            <span>{t("cowork.running")}</span>
          </div>
        )}

        {error && (
          <div className="msg msg-error">
            <pre className="msg-text">{error}</pre>
          </div>
        )}
      </div>

      {phase === "running" && (
        <div className="cowork-footer">
          <button
            className="stop-btn"
            onClick={() => {
              unsubRef.current?.();
              unsubRef.current = null;
              window.polypus?.stopRun?.();
              setPhase("idle");
              setTools([]);
              setAgentText("");
            }}
          >
            ■ Cancelar
          </button>
        </div>
      )}

      {phase === "done" && (
        <div className="cowork-footer">
          {summary && (
            <span className="cowork-summary">
              {t("cowork.done")} · {summary.files} {t("cowork.files")} · {summary.steps} {t("cowork.steps")}
              {(promptTokens + completionTokens) > 0 && (
                <>
                  {" · "}{fmtTokens(promptTokens + completionTokens)} tokens
                  {modelPrice && (
                    <span style={{ color: "var(--accent, #7c6af5)", fontWeight: 500 }}>
                      {" · "}{fmtCost(
                        (promptTokens * modelPrice.promptPrice + completionTokens * modelPrice.completionPrice) / 1_000_000,
                      )}
                    </span>
                  )}
                </>
              )}
            </span>
          )}
          <button className="btn" onClick={reset}>
            {t("cowork.newTask")}
          </button>
        </div>
      )}
    </div>
  );
}
