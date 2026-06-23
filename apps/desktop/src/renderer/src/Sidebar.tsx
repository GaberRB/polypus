import { useEffect, useState } from "react";
import { useSettings } from "./settings";
import type { RecentProject, SessionSummary } from "../../shared/ipc";

/** Folder name from a full path (handles / and \). */
function baseName(path: string): string {
  return path.replace(/[/\\]+$/, "").split(/[/\\]/).pop() || path;
}

/**
 * Sidebar (#117): recent projects and resumable sessions, loaded in-process via
 * the core lib through the bridge (window.polypus). Plus theme/idioma toggles.
 */
export function Sidebar(): JSX.Element {
  const { t, theme, setTheme, lang, setLang } = useSettings();
  const [projects, setProjects] = useState<RecentProject[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  useEffect(() => {
    void (async () => {
      const p = await window.polypus?.recentProjects();
      if (p?.ok) setProjects(p.data);
      const s = await window.polypus?.sessions();
      if (s?.ok) setSessions(s.data);
    })();
  }, []);

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="logo" aria-hidden>🐙</span>
        <span>Polypus Cowork</span>
      </div>

      <nav className="nav">
        <div className="nav-group">{t("nav.projects")}</div>
        {projects.length === 0 && <div className="nav-empty muted">—</div>}
        {projects.map((p) => (
          <button key={p.path} className="nav-item" title={p.path}>
            {baseName(p.path)}
          </button>
        ))}

        <div className="nav-group">{t("nav.sessions")}</div>
        {sessions.length === 0 && <div className="nav-empty muted">—</div>}
        {sessions.map((s) => (
          <button key={s.id} className="nav-item" title={s.title}>
            {s.title || s.id} <span className="muted">[{s.messageCount}]</span>
          </button>
        ))}
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
  );
}
