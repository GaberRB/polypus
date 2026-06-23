import { useState } from "react";
import { Chat } from "./Chat";
import { ModeSelector } from "./ModeSelector";
import type { Mode } from "../../shared/ipc";

/**
 * Cowork app shell — three panes (sidebar · main · context), matching the
 * wireframe in #112. The main pane hosts the chat/execução screen (#115) and the
 * context panel carries the permission-mode selector (#116). Remaining surfaces
 * (sidebar #117, onboarding #118, …) land next.
 */
export function App(): JSX.Element {
  const version = window.polypus?.version ?? "0.1.0";
  const bridgeReady = window.polypus?.ping?.() === "pong";
  const [mode, setMode] = useState<Mode>("review");

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo" aria-hidden>🐙</span>
          <span>Polypus Cowork</span>
        </div>

        <nav className="nav">
          <div className="nav-group">Projetos</div>
          <button className="nav-item">app/</button>
          <button className="nav-item">site/</button>
          <div className="nav-group">Sessões</div>
          <button className="nav-item">OAuth (3)</button>
        </nav>

        <div className="sidebar-foot">
          <button className="nav-item">＋ Nova</button>
          <button className="nav-item">⚙ Config</button>
        </div>
      </aside>

      <main className="main">
        <header className="main-head">
          <span className="prompt">🐙 polypus</span>
          <span className="muted">› chat / execução</span>
        </header>

        <Chat mode={mode} />
      </main>

      <aside className="context">
        <div className="ctx-row"><span className="muted">Projeto</span><span>—</span></div>
        <div className="ctx-row"><span className="muted">Agente</span><span>—</span></div>
        <div className="ctx-row ctx-row-modes"><span className="muted">Modo</span><ModeSelector mode={mode} onChange={setMode} /></div>
        <div className="ctx-row"><span className="muted">Custo</span><span>$0.00</span></div>
        <div className="ctx-row"><span className="muted">Ponte</span><span>{bridgeReady ? "pronta" : "—"}</span></div>
        <div className="ctx-foot muted">v{version}</div>
      </aside>
    </div>
  );
}
