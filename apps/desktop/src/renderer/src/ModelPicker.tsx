import { useEffect, useMemo, useState } from "react";
import { filterModels, fmtContext, fmtPrice, type ModelSort } from "./models";
import type { OpenRouterModel } from "../../shared/ipc";

const SORTS: { id: ModelSort; label: string }[] = [
  { id: "popularity-desc", label: "Mais populares" },
  { id: "price", label: "Menor custo" },
  { id: "context", label: "Maior contexto" },
  { id: "name", label: "Nome" },
];

/** Modal to browse/filter OpenRouter models and pick one (robust filter). */
export function ModelPicker({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }): JSX.Element {
  const [all, setAll] = useState<OpenRouterModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ModelSort>("popularity-desc");
  const [freeOnly, setFreeOnly] = useState(false);
  const [toolsOnly, setToolsOnly] = useState(false);

  useEffect(() => {
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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>Escolher modelo (OpenRouter)</strong>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="picker-filters">
          <input
            className="composer-input"
            placeholder="buscar modelo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={sort} onChange={(e) => setSort(e.target.value as ModelSort)}>
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <label className="chk"><input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} /> grátis</label>
          <label className="chk"><input type="checkbox" checked={toolsOnly} onChange={(e) => setToolsOnly(e.target.checked)} /> tools</label>
        </div>

        <div className="picker-list">
          {loading && <div className="muted">carregando modelos…</div>}
          {error && <div className="msg-error">{error}</div>}
          {!loading && !error && rows.length === 0 && <div className="muted">Nenhum modelo (configure a chave do OpenRouter).</div>}
          {rows.map((m) => (
            <button key={m.id} className="model-row" onClick={() => onPick(m.id)} title={m.id}>
              <span className="model-id">{m.id}</span>
              <span className="model-meta muted">
                {m.supportsTools ? "🛠 " : ""}
                {fmtPrice(m.promptPrice)}/{fmtPrice(m.completionPrice)} · {fmtContext(m.contextLength)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
