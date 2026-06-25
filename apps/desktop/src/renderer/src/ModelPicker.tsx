import { useEffect, useMemo, useRef, useState } from "react";
import { filterModels, fmtContext, fmtPrice, type ModelSort } from "./models";
import type { OpenRouterModel } from "../../shared/ipc";

const SORTS: { id: ModelSort; label: string }[] = [
  { id: "popularity-desc", label: "Mais populares" },
  { id: "price", label: "Menor custo" },
  { id: "context", label: "Maior contexto" },
  { id: "name", label: "Nome" },
];

const ROW_H = 44;
const VISIBLE_H = 360;
const BUFFER = 3;

/** Modal to browse/filter OpenRouter models and pick one. Virtual scroll for 200+ models. */
export function ModelPicker({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }): JSX.Element {
  const [all, setAll] = useState<OpenRouterModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ModelSort>("popularity-desc");
  const [freeOnly, setFreeOnly] = useState(false);
  const [toolsOnly, setToolsOnly] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
    void (async () => {
      const res = await window.polypus?.listModels();
      setLoading(false);
      if (!res) setError("Ponte indisponível.");
      else if (!res.ok) setError(res.error);
      else setAll(res.data);
    })();
  }, []);

  const rows = useMemo(
    () => filterModels(all, { search, sort, freeOnly, toolsOnly }).slice(0, 200),
    [all, search, sort, freeOnly, toolsOnly],
  );

  useEffect(() => { setActiveIdx(0); setScrollTop(0); if (listRef.current) listRef.current.scrollTop = 0; }, [search, sort, freeOnly, toolsOnly]);

  const scrollTo = (idx: number): void => {
    if (!listRef.current) return;
    const top = idx * ROW_H;
    const bot = top + ROW_H;
    if (top < listRef.current.scrollTop) listRef.current.scrollTop = top;
    else if (bot > listRef.current.scrollTop + VISIBLE_H) listRef.current.scrollTop = bot - VISIBLE_H;
  };

  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => { const next = Math.min(i + 1, rows.length - 1); scrollTo(next); return next; });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => { const next = Math.max(i - 1, 0); scrollTo(next); return next; });
    } else if (e.key === "Enter") {
      e.preventDefault();
      const m = rows[activeIdx];
      if (m) onPick(m.id);
    }
  };

  // Virtual scroll: which rows are visible?
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_H) - BUFFER);
  const endIdx = Math.min(rows.length, Math.ceil((scrollTop + VISIBLE_H) / ROW_H) + BUFFER);
  const totalH = rows.length * ROW_H;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Escolher modelo OpenRouter"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKey}
      >
        <div className="modal-head">
          <strong>Escolher modelo (OpenRouter)</strong>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar seletor de modelo">✕</button>
        </div>

        <div className="picker-filters">
          <input
            ref={searchRef}
            className="composer-input"
            placeholder="buscar modelo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar modelo"
          />
          <select value={sort} onChange={(e) => setSort(e.target.value as ModelSort)}>
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <label className="chk"><input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} /> grátis</label>
          <label className="chk"><input type="checkbox" checked={toolsOnly} onChange={(e) => setToolsOnly(e.target.checked)} /> tools</label>
        </div>

        <div
          ref={listRef}
          className="picker-list"
          style={{ height: VISIBLE_H, overflowY: "auto", position: "relative" }}
          onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
          role="listbox"
          aria-label="Modelos disponíveis"
        >
          {loading && Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: 36, margin: "2px 8px" }} />
          ))}
          {error && <div className="msg-error">{error}</div>}
          {!loading && !error && rows.length === 0 && <div className="muted" style={{ padding: 12 }}>Nenhum modelo (configure a chave do OpenRouter).</div>}
          {!loading && !error && rows.length > 0 && (
            <div style={{ height: totalH, position: "relative" }}>
              {rows.slice(startIdx, endIdx).map((m, rel) => {
                const idx = startIdx + rel;
                return (
                  <button
                    key={m.id}
                    className={`model-row${idx === activeIdx ? " model-row--active" : ""}`}
                    style={{ position: "absolute", top: idx * ROW_H, left: 0, right: 0, height: ROW_H }}
                    role="option"
                    aria-selected={idx === activeIdx}
                    onClick={() => onPick(m.id)}
                    onMouseEnter={() => setActiveIdx(idx)}
                    title={m.id}
                  >
                    <span className="model-id">{m.id}</span>
                    <span className="model-meta muted">
                      {m.supportsTools ? "🛠 " : ""}
                      {fmtPrice(m.promptPrice)}/{fmtPrice(m.completionPrice)} · {fmtContext(m.contextLength)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
