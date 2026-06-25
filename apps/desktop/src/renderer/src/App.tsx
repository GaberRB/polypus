import { useEffect, useRef, useState } from "react";
import { Chat } from "./Chat";
import { CommandPalette, type Command } from "./CommandPalette";
import { Cowork } from "./Cowork";
import { FileViewer } from "./FileViewer";
import { Onboarding, needsOnboarding } from "./Onboarding";
import { PlainChat } from "./PlainChat";
import { RagPanel } from "./RagPanel";
import { Sidebar } from "./Sidebar";
import { ModeSelector } from "./ModeSelector";
import { SettingsModal } from "./SettingsModal";
import { ToastProvider } from "./Toast";
import type { LoadedSession, Mode } from "../../shared/ipc";

type Tab = "chat" | "cowork" | "code";

function baseName(p: string): string {
  return p.replace(/[/\\]+$/, "").split(/[/\\]/).pop() || p;
}

function ProjectSwitchWarning({
  onConfirm,
  onCancel,
}: {
  onConfirm: (dontShowAgain: boolean) => void;
  onCancel: () => void;
}): JSX.Element {
  const [dontShow, setDontShow] = useState(false);
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>Trocar de projeto</h3>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "8px 0 16px" }}>
          Suas sessões deste projeto ficarão salvas e voltarão quando você selecionar este projeto novamente.
        </p>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)", marginBottom: 20, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={dontShow}
            onChange={(e) => setDontShow(e.target.checked)}
            style={{ cursor: "pointer" }}
          />
          Não mostrar novamente
        </label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onCancel} style={{ background: "transparent" }}>
            Cancelar
          </button>
          <button className="btn" onClick={() => onConfirm(dontShow)} style={{ background: "var(--accent)" }}>
            Trocar projeto
          </button>
        </div>
      </div>
    </div>
  );
}

export function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>("code");
  const [mode, setMode] = useState<Mode>(
    () => (localStorage.getItem("polypus.mode") as Mode | null) ?? "bypass",
  );
  const [project, setProject] = useState<string | null>(
    () => localStorage.getItem("polypus.lastProject"),
  );
  const [agentLabel, setAgentLabel] = useState("sem agente");
  const [showSettings, setShowSettings] = useState(false);
  const [codeView, setCodeView] = useState<"chat" | "rag">("chat");
  const [fileViewerPath, setFileViewerPath] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<LoadedSession | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const [pendingProject, setPendingProject] = useState<string | null>(null);
  const [showProjectWarning, setShowProjectWarning] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem("polypus.sidebarCollapsed") === "true",
  );
  const [showCmdPalette, setShowCmdPalette] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => needsOnboarding());

  const loadAgent = async (): Promise<void> => {
    const res = await window.polypus?.getConfig();
    if (res?.ok) {
      const def = res.data.agents.find((a) => a.name === res.data.defaultAgent) ?? res.data.agents[0];
      setAgentLabel(def ? `${def.provider}/${def.model}` : "sem agente");
    }
  };
  useEffect(() => {
    void loadAgent();
  }, []);

  const switchProject = (path: string): void => {
    if (!project || project === path) {
      setProject(path);
      localStorage.setItem("polypus.lastProject", path);
      return;
    }
    const suppress = localStorage.getItem("polypus.suppressProjectWarning") === "true";
    if (suppress) {
      setProject(path);
      handleNewSession();
    } else {
      setPendingProject(path);
      setShowProjectWarning(true);
    }
  };

  const confirmSwitchProject = (dontShowAgain: boolean): void => {
    if (dontShowAgain) localStorage.setItem("polypus.suppressProjectWarning", "true");
    if (pendingProject) {
      setProject(pendingProject);
      localStorage.setItem("polypus.lastProject", pendingProject);
      handleNewSession();
      setPendingProject(null);
    }
    setShowProjectWarning(false);
  };

  const chooseFolder = async (): Promise<void> => {
    const res = await window.polypus?.chooseFolder();
    if (res?.ok && res.data) switchProject(res.data);
  };

  const handleLoadSession = async (id: string): Promise<void> => {
    const res = await window.polypus?.loadSession(id);
    if (res?.ok && res.data) {
      setActiveSession(res.data as LoadedSession);
      setTab("code");
      setCodeView("chat");
    }
  };

  const handleNewSession = (): void => {
    setActiveSession(null);
    setSessionKey((k) => k + 1);
  };

  const toggleSidebar = (): void => {
    setSidebarCollapsed((v) => {
      const next = !v;
      localStorage.setItem("polypus.sidebarCollapsed", String(next));
      return next;
    });
  };

  // Global keyboard shortcuts
  const cmdPaletteRef = useRef(false);
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const meta = e.metaKey || e.ctrlKey;
      // Don't fire when typing in inputs/textareas
      const target = e.target as HTMLElement;
      const inInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      if (meta && e.key === "k") {
        e.preventDefault();
        setShowCmdPalette((v) => !v);
        return;
      }
      if (inInput) return;
      if (meta && e.key === "n") { e.preventDefault(); handleNewSession(); }
      if (meta && e.key === ",") { e.preventDefault(); setShowSettings(true); }
      if (meta && e.key === "b") { e.preventDefault(); toggleSidebar(); }
      if (meta && e.key === "1") { e.preventDefault(); setTab("chat"); }
      if (meta && e.key === "2") { e.preventDefault(); setTab("cowork"); }
      if (meta && e.key === "3") { e.preventDefault(); setTab("code"); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  cmdPaletteRef.current = showCmdPalette;

  const commands: Command[] = [
    { id: "new-session", label: "Nova sessão", icon: "＋", group: "Sessão", action: handleNewSession, keywords: ["new", "session", "reset"] },
    { id: "open-settings", label: "Abrir configurações", icon: "⚙", group: "App", action: () => setShowSettings(true), keywords: ["settings", "config", "api", "chave"] },
    { id: "choose-project", label: "Escolher pasta do projeto", icon: "📁", group: "Projeto", action: () => void chooseFolder(), keywords: ["folder", "pasta", "projeto", "open"] },
    { id: "toggle-sidebar", label: "Toggle sidebar", icon: sidebarCollapsed ? "▸" : "◂", group: "App", action: toggleSidebar, keywords: ["sidebar", "collapse", "hide"] },
    { id: "tab-chat", label: "Ir para aba Chat", icon: "💬", group: "Navegação", action: () => setTab("chat"), keywords: ["chat", "conversa"] },
    { id: "tab-cowork", label: "Ir para aba Cowork", icon: "⚡", group: "Navegação", action: () => setTab("cowork"), keywords: ["cowork", "task"] },
    { id: "tab-code", label: "Ir para aba Code", icon: "⌥", group: "Navegação", action: () => setTab("code"), keywords: ["code", "código", "run"] },
    { id: "mode-plan", label: "Modo: Plan (somente leitura)", icon: "📋", group: "Modo", action: () => { setMode("plan"); localStorage.setItem("polypus.mode", "plan"); }, keywords: ["plan", "readonly"] },
    { id: "mode-review", label: "Modo: Review (confirmar ações)", icon: "👁", group: "Modo", action: () => { setMode("review"); localStorage.setItem("polypus.mode", "review"); }, keywords: ["review", "confirm"] },
    { id: "mode-bypass", label: "Modo: Bypass (automático)", icon: "⚡", group: "Modo", action: () => { setMode("bypass"); localStorage.setItem("polypus.mode", "bypass"); }, keywords: ["bypass", "auto", "auto-approve"] },
  ];

  const TABS: { id: Tab; label: string }[] = [
    { id: "chat", label: "Chat" },
    { id: "cowork", label: "Cowork" },
    { id: "code", label: "Code" },
  ];

  return (
    <ToastProvider>
      <div
        className="shell-2col"
        data-sidebar-collapsed={sidebarCollapsed ? "true" : undefined}
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          onSettings={() => setShowSettings(true)}
          onPickProject={switchProject}
          onLoadSession={(id) => void handleLoadSession(id)}
          onNewSession={handleNewSession}
          onOpenFile={setFileViewerPath}
          project={project ?? undefined}
          activeSessionId={activeSession?.id}
        />

        <div className="workarea">
          <header className="topbar">
            <div className="toptabs">
              {TABS.map((x) => (
                <button key={x.id} className={`toptab${tab === x.id ? " on" : ""}`} onClick={() => setTab(x.id)}>
                  {x.label}
                </button>
              ))}
            </div>
            <div className="topbar-right">
              {tab === "code" && (
                <button className="chip" onClick={chooseFolder} title={project ?? ""}>
                  📁 {project ? baseName(project) : "Escolher pasta"}
                </button>
              )}
              {tab !== "chat" && (
                <ModeSelector
                  mode={mode}
                  onChange={(m) => {
                    setMode(m);
                    localStorage.setItem("polypus.mode", m);
                  }}
                />
              )}
              <button
                className={`chip${agentLabel === "sem agente" ? " chip-warn" : ""}`}
                onClick={() => setShowSettings(true)}
                title="Personalizar"
              >
                {agentLabel === "sem agente" ? "⚠ Configurar agente" : `${agentLabel} ▾`}
              </button>
              <button
                className="icon-btn"
                title="Palette de comandos (Cmd+K)"
                aria-label="Abrir palette de comandos"
                onClick={() => setShowCmdPalette(true)}
              >
                ⌘K
              </button>
            </div>
          </header>

          <div className="content">
            {tab === "chat" && <PlainChat />}

            {tab === "code" && (
              <>
                <div className="subtabs">
                  <button className={`subtab${codeView === "chat" ? " on" : ""}`} onClick={() => setCodeView("chat")}>
                    Conversa
                  </button>
                  <button className={`subtab${codeView === "rag" ? " on" : ""}`} onClick={() => setCodeView("rag")}>
                    Índice (RAG)
                  </button>
                </div>
                {codeView === "chat" ? (
                  <Chat
                    mode={mode}
                    dir={project ?? undefined}
                    initialSession={activeSession ?? undefined}
                    key={activeSession?.id ?? `new-${sessionKey}`}
                  />
                ) : (
                  <RagPanel />
                )}
              </>
            )}

            {tab === "cowork" && (
              <Cowork mode={mode} dir={project} onPickProject={setProject} />
            )}
          </div>
        </div>

        {showSettings && (
          <SettingsModal
            onClose={() => setShowSettings(false)}
            onSaved={loadAgent}
            project={project ?? undefined}
          />
        )}

        <FileViewer path={fileViewerPath} onClose={() => setFileViewerPath(null)} />

        {showProjectWarning && (
          <ProjectSwitchWarning
            onConfirm={confirmSwitchProject}
            onCancel={() => { setShowProjectWarning(false); setPendingProject(null); }}
          />
        )}

        {showCmdPalette && (
          <CommandPalette commands={commands} onClose={() => setShowCmdPalette(false)} />
        )}

        {showOnboarding && (
          <Onboarding onDone={() => setShowOnboarding(false)} />
        )}
      </div>
    </ToastProvider>
  );
}
