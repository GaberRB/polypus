import { useEffect, useState } from "react";
import { Chat } from "./Chat";
import { Cowork } from "./Cowork";
import { FileViewer } from "./FileViewer";
import { PlainChat } from "./PlainChat";
import { RagPanel } from "./RagPanel";
import { Sidebar } from "./Sidebar";
import { ModeSelector } from "./ModeSelector";
import { SettingsModal } from "./SettingsModal";
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
          <button className="btn" onClick={() => onConfirm(dontShow)} style={{ background: "var(--accent, #7c6af5)" }}>
            Trocar projeto
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Cowork shell, mirroring claude_desktop.png: top tabs (Chat/Cowork/Code) + a
 * sidebar + a work area whose top bar carries the project folder, mode and model
 * selectors. Chat = plain talk; Code = project agent (streaming); Cowork = base.
 */
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

  const TABS: { id: Tab; label: string }[] = [
    { id: "chat", label: "Chat" },
    { id: "cowork", label: "Cowork" },
    { id: "code", label: "Code" },
  ];

  return (
    <div className="shell-2col">
      <Sidebar
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
    </div>
  );
}
