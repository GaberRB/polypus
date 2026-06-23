/**
 * Cowork app shell — three panes (sidebar · main · context), matching the
 * wireframe in #112. Everything here is a placeholder; real screens land in the
 * follow-up issues (chat/execução #115, aprovação #116, sidebar #117, …).
 */
export function App(): JSX.Element {
  const version = window.polypus?.version ?? "0.1.0";

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
          <span className="muted">› esqueleto inicial (#113)</span>
        </header>

        <section className="conversation">
          <p className="empty">
            A tela de chat/execução com streaming legível chega no #115.
            <br />
            Aqui vão os passos do agente, diffs e aprovações.
          </p>
        </section>

        <footer className="composer">
          <input className="composer-input" placeholder="digite uma tarefa…" disabled />
        </footer>
      </main>

      <aside className="context">
        <div className="ctx-row"><span className="muted">Projeto</span><span>—</span></div>
        <div className="ctx-row"><span className="muted">Agente</span><span>—</span></div>
        <div className="ctx-row"><span className="muted">Modo</span><span className="pill">review</span></div>
        <div className="ctx-row"><span className="muted">Custo</span><span>$0.00</span></div>
        <div className="ctx-foot muted">v{version}</div>
      </aside>
    </div>
  );
}
