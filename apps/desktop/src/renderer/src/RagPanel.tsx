import { useState, type KeyboardEvent } from "react";
import { useSettings } from "./settings";

/**
 * RAG panel (#121): reindex the project and search it semantically, over the
 * existing `polypus index` / `polypus retrieve` CLI commands (via the bridge).
 */
export function RagPanel(): JSX.Element {
  const { t } = useSettings();
  const [query, setQuery] = useState("");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState<"" | "index" | "search">("");

  const reindex = async (): Promise<void> => {
    if (busy) return;
    setBusy("index");
    setOutput("");
    const res = await window.polypus?.index();
    setBusy("");
    setOutput(!res ? t("chat.bridgeUnavailable") : res.ok ? res.data : res.error);
  };

  const search = async (): Promise<void> => {
    const q = query.trim();
    if (!q || busy) return;
    setBusy("search");
    setOutput("");
    const res = await window.polypus?.retrieve(q);
    setBusy("");
    setOutput(!res ? t("chat.bridgeUnavailable") : res.ok ? res.data : res.error);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") {
      e.preventDefault();
      void search();
    }
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

      <div className="rag-out">{output && <pre className="msg-text">{output}</pre>}</div>
    </div>
  );
}
