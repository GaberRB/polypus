import { useState } from "react";
import { Chat } from "./Chat";
import { ModeSelector } from "./ModeSelector";
import { RagPanel } from "./RagPanel";
import { Sidebar } from "./Sidebar";
import { useSettings } from "./settings";
import type { Mode } from "../../shared/ipc";

type View = "chat" | "rag";

/**
 * Cowork app shell — three panes (sidebar · main · context), matching the
 * wireframe in #112. Hosts the sidebar (#117), chat/execução (#115), the
 * permission-mode selector (#116), the RAG panel (#121) and theme/i18n (#119).
 */
export function App(): JSX.Element {
  const { t } = useSettings();
  const version = window.polypus?.version ?? "0.1.0";
  const bridgeReady = window.polypus?.ping?.() === "pong";
  const [mode, setMode] = useState<Mode>("review");
  const [view, setView] = useState<View>("chat");

  return (
    <div className="shell">
      <Sidebar />

      <main className="main">
        <header className="main-head">
          <span className="prompt">🐙 polypus</span>
          <span className="tabs">
            <button
              className={`tab${view === "chat" ? " tab-on" : ""}`}
              onClick={() => setView("chat")}
            >
              {t("tab.chat")}
            </button>
            <button
              className={`tab${view === "rag" ? " tab-on" : ""}`}
              onClick={() => setView("rag")}
            >
              {t("tab.rag")}
            </button>
          </span>
        </header>

        {view === "chat" ? <Chat mode={mode} /> : <RagPanel />}
      </main>

      <aside className="context">
        <div className="ctx-row"><span className="muted">{t("ctx.project")}</span><span>—</span></div>
        <div className="ctx-row"><span className="muted">{t("ctx.agent")}</span><span>—</span></div>
        <div className="ctx-row ctx-row-modes"><span className="muted">{t("ctx.mode")}</span><ModeSelector mode={mode} onChange={setMode} /></div>
        <div className="ctx-row"><span className="muted">{t("ctx.cost")}</span><span>$0.00</span></div>
        <div className="ctx-row"><span className="muted">{t("ctx.bridge")}</span><span>{bridgeReady ? t("ctx.bridgeReady") : "—"}</span></div>
        <div className="ctx-foot muted">v{version}</div>
      </aside>
    </div>
  );
}
