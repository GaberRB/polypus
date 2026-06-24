import { useEffect, useState } from "react";
import { Chat } from "./Chat";
import { PlainChat } from "./PlainChat";
import { RagPanel } from "./RagPanel";
import { Sidebar } from "./Sidebar";
import { ModeSelector } from "./ModeSelector";
import { SettingsModal } from "./SettingsModal";
import type { Mode } from "../../shared/ipc";

type Tab = "chat" | "cowork" | "code";

function baseName(p: string): string {
  return p.replace(/[/\\]+$/, "").split(/[/\\]/).pop() || p;
}

/**
 * Cowork shell, mirroring claude_desktop.png: top tabs (Chat/Cowork/Code) + a
 * sidebar + a work area whose top bar carries the project folder, mode and model
 * selectors. Chat = plain talk; Code = project agent (streaming); Cowork = base.
 */
export function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>("code");
  const [mode, setMode] = useState<Mode>("review");
  const [project, setProject] = useState<string | null>(null);
  const [agentLabel, setAgentLabel] = useState("sem agente");
  const [showSettings, setShowSettings] = useState(false);
  const [codeView, setCodeView] = useState<"chat" | "rag">("chat");

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

  const chooseFolder = async (): Promise<void> => {
    const res = await window.polypus?.chooseFolder();
    if (res?.ok && res.data) setProject(res.data);
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: "chat", label: "Chat" },
    { id: "cowork", label: "Cowork" },
    { id: "code", label: "Code" },
  ];

  return (
    <div className="shell-2col">
      <Sidebar onSettings={() => setShowSettings(true)} onPickProject={setProject} />

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
            {tab !== "chat" && <ModeSelector mode={mode} onChange={setMode} />}
            <button className="chip" onClick={() => setShowSettings(true)} title="Personalizar">
              {agentLabel} ▾
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
              {codeView === "chat" ? <Chat mode={mode} dir={project ?? undefined} /> : <RagPanel />}
            </>
          )}

          {tab === "cowork" && (
            <div className="placeholder muted">Cowork (multi-agente / swarm) — em breve.</div>
          )}
        </div>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onSaved={loadAgent} />}
    </div>
  );
}
