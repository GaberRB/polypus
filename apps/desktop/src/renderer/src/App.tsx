import { useState } from "react";
import { Chat } from "./Chat";
import { ModeSelector } from "./ModeSelector";
import { useSettings } from "./settings";
import type { Mode } from "../../shared/ipc";

/**
 * Cowork app shell — three panes (sidebar · main · context), matching the
 * wireframe in #112. Hosts the chat/execução screen (#115), the permission-mode
 * selector (#116), and theme/idioma toggles (#119).
 */
export function App(): JSX.Element {
  const { t, theme, setTheme, lang, setLang } = useSettings();
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
          <div className="nav-group">{t("nav.projects")}</div>
          <button className="nav-item">app/</button>
          <button className="nav-item">site/</button>
          <div className="nav-group">{t("nav.sessions")}</div>
          <button className="nav-item">OAuth (3)</button>
        </nav>

        <div className="sidebar-foot">
          <div className="toggles">
            <button
              className="nav-item toggle"
              title={t("settings.theme")}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? "🌙" : "☀️"} {t("settings.theme")}
            </button>
            <button
              className="nav-item toggle"
              title={t("settings.lang")}
              onClick={() => setLang(lang === "pt-BR" ? "en" : "pt-BR")}
            >
              🌐 {lang}
            </button>
          </div>
          <button className="nav-item">{t("nav.new")}</button>
          <button className="nav-item">{t("nav.config")}</button>
        </div>
      </aside>

      <main className="main">
        <header className="main-head">
          <span className="prompt">🐙 polypus</span>
          <span className="muted">› {t("header.chat")}</span>
        </header>

        <Chat mode={mode} />
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
