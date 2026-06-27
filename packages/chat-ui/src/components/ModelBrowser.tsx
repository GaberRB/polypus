/**
 * OpenRouter model browser (VC2). A searchable modal listing models with their
 * price (per 1M tokens), context length, and tool support, so the user can pick
 * any model to run with (passed as `--model`). Debounced search via the host.
 */
import { useEffect, useRef, useState } from "react";
import type { ChatTransport, OpenRouterModelInfo } from "../transport.js";

function fmtPrice(perMillion: number): string {
  if (perMillion < 0) return "?";
  if (perMillion === 0) return "grátis";
  if (perMillion < 1) return `$${perMillion.toFixed(2)}`;
  return `$${perMillion.toFixed(1)}`;
}

function fmtContext(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

export function ModelBrowser({
  transport,
  current,
  onPick,
  onClose,
}: {
  transport: ChatTransport;
  current?: string;
  onPick: (modelId: string) => void;
  onClose: () => void;
}): JSX.Element {
  const [query, setQuery] = useState("");
  const [models, setModels] = useState<OpenRouterModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);

  useEffect(() => {
    const id = ++seq.current;
    setLoading(true);
    const handle = setTimeout(() => {
      void transport
        .searchModels(query)
        .then((res) => {
          if (id === seq.current) setModels(res);
        })
        .catch(() => {
          if (id === seq.current) setModels([]);
        })
        .finally(() => {
          if (id === seq.current) setLoading(false);
        });
    }, 250); // debounce
    return () => clearTimeout(handle);
  }, [query, transport]);

  return (
    <div className="model-browser-overlay" onClick={onClose}>
      <div className="model-browser" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Modelos OpenRouter">
        <div className="model-browser-head">
          <input
            className="model-search"
            placeholder="Buscar modelos do OpenRouter…"
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="control-icon-btn" title="Fechar" onClick={onClose}>✕</button>
        </div>
        <div className="model-list">
          {loading && <div className="model-empty muted">Carregando…</div>}
          {!loading && models.length === 0 && <div className="model-empty muted">Nenhum modelo encontrado.</div>}
          {!loading &&
            models.map((m) => (
              <button
                key={m.id}
                className={`model-row${m.id === current ? " model-row--active" : ""}`}
                onClick={() => onPick(m.id)}
                title={m.id}
              >
                <span className={`model-tools${m.supportsTools ? " model-tools--yes" : ""}`} aria-hidden>
                  {m.supportsTools ? "🛠" : "—"}
                </span>
                <span className="model-name">{m.name}</span>
                <span className="model-meta">
                  <span className={m.free ? "model-free" : "model-price"}>
                    {fmtPrice(m.promptPrice)}/{fmtPrice(m.completionPrice)}
                  </span>
                  <span className="model-ctx">{fmtContext(m.contextLength)}</span>
                </span>
              </button>
            ))}
        </div>
        <div className="model-browser-foot muted">
          🛠 = suporta tools · preço por 1M tokens (entrada/saída) · contexto
        </div>
      </div>
    </div>
  );
}
