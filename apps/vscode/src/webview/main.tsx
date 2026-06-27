/** Webview bootstrap (T5): mount the shared chat UI with the VSCode transport. */
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Chat, type Mode } from "@gaberrb/polypus-chat-ui";
import "@gaberrb/polypus-chat-ui/styles.css";
import { VsCodeTransport } from "./transport.js";

const transport = new VsCodeTransport();

function App(): JSX.Element {
  const [hasProject, setHasProject] = useState(true);
  const [hasKey, setHasKey] = useState(true);
  const [mode, setMode] = useState<Mode>("review");

  useEffect(() => {
    transport.onInit((msg) => {
      setHasProject(msg.hasProject);
      setHasKey(msg.hasKey);
      setMode(msg.mode);
    });
    transport.ready();
  }, []);

  if (!hasKey) {
    return (
      <div className="onboarding">
        <p>Configure sua chave do OpenRouter para começar.</p>
        <button className="choice-confirm" onClick={() => transport.requestApiKey()}>
          Configurar chave
        </button>
        <p className="muted">
          Crie uma chave grátis em <span className="onboarding-link">openrouter.ai/keys</span> e cole aqui.
        </p>
      </div>
    );
  }

  return <Chat transport={transport} mode={mode} hasProject={hasProject} />;
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
