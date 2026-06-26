import { useState, type KeyboardEvent } from "react";
import { useSettings } from "./settings";

interface RagResult {
  score: number;
  path: string;
  line: number;
  snippet: string;
}

// Parses `polypus retrieve` output into structured cards.
// Format per chunk: "score: 0.87 | path/to/file.ts:42\n<snippet>"
function parseRagOutput(raw: string): RagResult[] | null {
  const chunks = raw.split(/\n(?=score:\s)/i);
  const results: RagResult[] = [];
  for (const chunk of chunks) {
    const headerMatch = /^score:\s*([0-9.]+)\s*\|\s*(.+?):(\d+)/i.exec(chunk);
    if (!headerMatch) return null;
    const [, scoreStr, path, lineStr] = headerMatch;
    const snippet = chunk.slice(headerMatch[0].length).replace(/^\n/, "").trim();
    results.push({
      score: parseFloat(scoreStr ?? "0"),
      path: path ?? "",
      line: parseInt(lineStr ?? "0", 10),
      snippet,
    });
  }
  return results.length > 0 ? results : null;
}

function fileName(p: string): string {
  return p.replace(/\\/g, "/").split("/").pop() ?? p;
}

function scoreBadgeClass(s: number): string {
  if (s >= 0.8) return "rag-score rag-score--high";
  if (s >= 0.5) return "rag-score rag-score--mid";
  return "rag-score rag-score--low";
}

/**
 * RAG panel (#121): reindex the project and search it semantically, over the
 * existing `polypus index` / `polypus retrieve` CLI commands (via the bridge).
 */
export function RagPanel(): JSX.Element {
  const { t } = useSettings();
  const [query, setQuery] = useState("");
  const [output, setOutput] = useState("");
  const [results, setResults] = useState<RagResult[] | null>(null);
  const [busy, setBusy] = useState<"" | "index" | "search">("");

  const reindex = async (): Promise<void> => {
    if (busy) return;
    setBusy("index");
    setOutput("");
    setResults(null);
    const res = await window.polypus?.index();
    setBusy("");
    setOutput(!res ? t("chat.bridgeUnavailable") : res.ok ? res.data : res.error);
  };

  const search = async (): Promise<void> => {
    const q = query.trim();
    if (!q || busy) return;
    setBusy("search");
    setOutput("");
    setResults(null);
    const res = await window.polypus?.retrieve(q);
    setBusy("");
    if (!res) { setOutput(t("chat.bridgeUnavailable")); return; }
    if (!res.ok) { setOutput(res.error); return; }
    const parsed = parseRagOutput(res.data);
    if (parsed) setResults(parsed);
    else setOutput(res.data);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") { e.preventDefault(); void search(); }
  };

  return (
    <div className="rag">
      <div className="rag-head">
        <div>
          <div className="rag-title">{t("rag.title")}</div>
          <div className="muted rag-hint">{t("rag.hint")}</div>
        </div>
        <button className="btn" onClick={reindex} disabled={busy !== ""}>
          {busy === "index" ? t("rag.indexing") : t("rag.reindex")}
        </button>
      </div>

      <div className="rag-search">
        <input
          className="composer-input"
          placeholder={t("rag.searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
          disabled={busy !== ""}
        />
        <button className="btn" onClick={search} disabled={busy !== "" || !query.trim()}>
          {busy === "search" ? t("rag.searching") : t("rag.search")}
        </button>
      </div>

      <div className="rag-out">
        {busy === "search" && (
          <div style={{ padding: "12px 0" }}>
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="skeleton" style={{ height: 72, marginBottom: 8, borderRadius: 8 }} />
            ))}
          </div>
        )}
        {results && results.map((r, i) => (
          <div key={i} className="rag-card">
            <div className="rag-card-head">
              <span className="rag-file" title={r.path}>{fileName(r.path)}</span>
              {r.line > 0 && <span className="rag-line muted">:{r.line}</span>}
              <span className={scoreBadgeClass(r.score)}>{(r.score * 100).toFixed(0)}%</span>
            </div>
            {r.snippet && <pre className="rag-snippet">{r.snippet}</pre>}
          </div>
        ))}
        {output && <pre className="msg-text">{output}</pre>}
      </div>
    </div>
  );
}
