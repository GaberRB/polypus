import { useEffect, useState } from "react";
import { useSettings } from "./settings";
import type { DirEntry, RecentProject, SessionSummary } from "../../shared/ipc";

function baseName(path: string): string {
  return path.replace(/[/\\]+$/, "").split(/[/\\]/).pop() || path;
}

// ── File tree node ────────────────────────────────────────────────────────

interface TreeNodeProps {
  entry: DirEntry;
  depth: number;
  onOpenFile: (path: string) => void;
}

function TreeNode({ entry, depth, onOpenFile }: TreeNodeProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<DirEntry[] | null>(null);

  const toggle = async () => {
    if (entry.type === "file") {
      onOpenFile(entry.path);
      return;
    }
    if (!open && children === null) {
      const res = await window.polypus?.dirList(entry.path);
      setChildren(res?.ok ? res.data : []);
    }
    setOpen((v) => !v);
  };

  const icon = entry.type === "dir" ? (open ? "▾" : "▸") : "·";

  return (
    <>
      <button
        className="file-tree-node"
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => void toggle()}
        title={entry.path}
      >
        <span className="file-tree-icon">{icon}</span>
        {entry.name}
      </button>
      {open && children && children.map((c) => (
        <TreeNode key={c.path} entry={c} depth={depth + 1} onOpenFile={onOpenFile} />
      ))}
    </>
  );
}

// ── Session item with hover delete ────────────────────────────────────────

interface SessionItemProps {
  session: SessionSummary;
  isActive: boolean;
  onLoad: (id: string) => void;
  onDeleted: (id: string) => void;
  deleteLabel: string;
}

function SessionItem({ session, isActive, onLoad, onDeleted, deleteLabel }: SessionItemProps): JSX.Element {
  const doDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Optimistic: remove from list immediately, fire delete in background.
    onDeleted(session.id);
    void window.polypus?.deleteSession(session.id);
  };

  return (
    <div className="nav-item-row">
      <button
        className={`nav-item${isActive ? " active" : ""}`}
        title={session.title || session.id}
        onClick={() => onLoad(session.id)}
      >
        {session.title || session.id}
      </button>
      <div className="nav-item-actions">
        <button
          className="nav-action-btn"
          title={deleteLabel}
          onClick={doDelete}
        >
          🗑
        </button>
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────

export function Sidebar({
  onSettings,
  onPickProject,
  onLoadSession,
  onNewSession,
  onOpenFile,
  project,
  activeSessionId,
}: {
  onSettings: () => void;
  onPickProject: (path: string) => void;
  onLoadSession: (id: string) => void;
  onNewSession: () => void;
  onOpenFile: (path: string) => void;
  project?: string;
  activeSessionId?: string;
}): JSX.Element {
  const { t, theme, setTheme, lang, setLang } = useSettings();
  const [projects, setProjects] = useState<RecentProject[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [rootEntries, setRootEntries] = useState<DirEntry[] | null>(null);
  const [mcpCount, setMcpCount] = useState(0);
  const [filesOpen, setFilesOpen] = useState(false);

  useEffect(() => {
    void window.polypus?.recentProjects().then((p) => {
      if (p?.ok) setProjects(p.data);
    });
  }, []);

  // Reload sessions whenever the active project changes.
  useEffect(() => {
    void window.polypus?.sessions(project ?? undefined).then((s) => {
      if (s?.ok) setSessions(s.data.filter(isRealSession));
      else setSessions([]);
    });
  }, [project]);

  useEffect(() => {
    if (!project) {
      setMcpCount(0);
      setRootEntries(null);
      return;
    }
    void (async () => {
      const res = await window.polypus?.mcpList(project);
      setMcpCount(res?.ok ? res.data.length : 0);
    })();
  }, [project]);

  const loadTree = async () => {
    if (!project) return;
    setFilesOpen((v) => {
      if (!v && rootEntries === null) {
        void window.polypus?.dirList(project).then((res) => {
          setRootEntries(res?.ok ? res.data : []);
        });
      }
      return !v;
    });
  };

  const handleDeleted = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="logo" aria-hidden>🐙</span>
        <span>Polypus Cowork</span>
      </div>

      <nav className="nav">
        {/* Projects */}
        <div className="nav-group">{t("nav.projects")}</div>
        {projects.length === 0 ? (
          <div className="nav-empty muted">{t("nav.emptyProjects")}</div>
        ) : (
          projects.map((p) => (
            <button key={p.path} className="nav-item" title={p.path} onClick={() => onPickProject(p.path)}>
              {baseName(p.path)}
            </button>
          ))
        )}

        {/* Sessions */}
        <div className="nav-group" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>{t("nav.sessions")}</span>
          <button
            className="nav-action-btn"
            style={{ display: "inline-flex", fontSize: "11px" }}
            title={t("nav.newSession")}
            onClick={onNewSession}
          >
            ＋
          </button>
        </div>
        {sessions.length === 0 ? (
          <div className="nav-empty muted">{t("nav.emptySessions")}</div>
        ) : (
          sessions.map((s) => (
            <SessionItem
              key={s.id}
              session={s}
              isActive={s.id === activeSessionId}
              onLoad={onLoadSession}
              onDeleted={handleDeleted}
              deleteLabel={t("nav.deleteSession")}
            />
          ))
        )}

        {/* Files section */}
        {project && (
          <>
            <div className="nav-group" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>{t("nav.files")}</span>
              <button className="nav-action-btn" style={{ fontSize: "11px" }} onClick={() => void loadTree()}>
                {filesOpen ? "▾" : "▸"}
              </button>
            </div>
            {filesOpen && (
              <div className="file-tree">
                {rootEntries === null ? (
                  <div className="nav-empty muted">…</div>
                ) : rootEntries.length === 0 ? (
                  <div className="nav-empty muted">{t("nav.noFiles")}</div>
                ) : (
                  rootEntries.map((e) => (
                    <TreeNode key={e.path} entry={e} depth={0} onOpenFile={onOpenFile} />
                  ))
                )}
              </div>
            )}
          </>
        )}

        {mcpCount > 0 && (
          <button className="mcp-indicator" onClick={onSettings} title="Configurar servidores MCP">
            {t("nav.mcpServers").replace("{{n}}", String(mcpCount))}
          </button>
        )}
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
        <button className="nav-item" onClick={onSettings}>{t("nav.config")}</button>
      </div>
    </aside>
  );
}

function isRealSession(s: SessionSummary): boolean {
  // Require at least one agent response (messageCount >= 2 = user + agent).
  // Filters out sessions from runs that errored before the agent replied.
  return s.messageCount >= 2;
}
