import { useEffect, useState } from "react";
import { ModelPicker } from "./ModelPicker";
import type { ConfigSnapshot } from "../../shared/ipc";

const PROVIDERS = ["openrouter", "ollama", "openai-compatible", "anthropic"] as const;

/**
 * Settings ("Personalizar"): configure providers + API keys (saved to
 * ~/.polypus/.env), pick the model (ModelPicker for OpenRouter), test the
 * connection and set the default agent.
 */
export function SettingsModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }): JSX.Element {
  const [cfg, setCfg] = useState<ConfigSnapshot | null>(null);
  const [provider, setProvider] = useState<string>("openrouter");
  const [name, setName] = useState("openrouter");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [setDefault, setSetDefault] = useState(true);
  const [picking, setPicking] = useState(false);
  const [status, setStatus] = useState("");

  const reload = async (): Promise<void> => {
    const res = await window.polypus?.getConfig();
    if (res?.ok) setCfg(res.data);
  };
  useEffect(() => {
    void reload();
  }, []);

  const save = async (): Promise<void> => {
    if (!model.trim()) {
      setStatus("Informe um modelo.");
      return;
    }
    setStatus("salvando…");
    const res = await window.polypus?.saveAgent({
      name: name.trim() || provider,
      provider,
      model: model.trim(),
      baseUrl: baseUrl.trim() || undefined,
      apiKey: apiKey.trim() || undefined,
      setDefault,
    });
    if (!res?.ok) {
      setStatus(res?.error ?? "Falha ao salvar.");
      return;
    }
    setApiKey("");
    setStatus("✓ salvo");
    await reload();
    onSaved();
  };

  const test = async (agentName: string): Promise<void> => {
    setStatus("testando…");
    const res = await window.polypus?.testAgent(agentName);
    setStatus(!res?.ok ? (res?.error ?? "erro") : res.data.ok ? "✓ conexão ok" : `✗ ${res.data.message}`);
  };

  const makeDefault = async (agentName: string): Promise<void> => {
    await window.polypus?.setDefaultAgent(agentName);
    await reload();
    onSaved();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>Personalizar — agentes e chaves</strong>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="settings-body">
          <div className="field">
            <label>Provider</label>
            <select
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                setName(e.target.value);
              }}
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Nome do agente</label>
            <input className="composer-input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="field">
            <label>Modelo</label>
            <div className="row">
              <input className="composer-input" value={model} onChange={(e) => setModel(e.target.value)} placeholder="ex.: openai/gpt-4o-mini" />
              {provider === "openrouter" && (
                <button className="btn" onClick={() => setPicking(true)}>Escolher…</button>
              )}
            </div>
          </div>

          {provider === "openai-compatible" && (
            <div className="field">
              <label>Base URL</label>
              <input className="composer-input" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://…/v1" />
            </div>
          )}

          <div className="field">
            <label>Chave de API {provider === "ollama" ? "(opcional)" : ""}</label>
            <input
              className="composer-input"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="cole a chave (vai pro ~/.polypus/.env)"
            />
          </div>

          <label className="chk">
            <input type="checkbox" checked={setDefault} onChange={(e) => setSetDefault(e.target.checked)} /> definir como padrão
          </label>

          <div className="row">
            <button className="btn" onClick={save}>Salvar agente</button>
            <span className="muted">{status}</span>
          </div>

          {cfg && cfg.agents.length > 0 && (
            <div className="agents-list">
              <div className="muted">Agentes configurados</div>
              {cfg.agents.map((a) => (
                <div className="agent-row" key={a.name}>
                  <span>
                    {a.name === cfg.defaultAgent ? "★ " : ""}
                    <strong>{a.name}</strong> <span className="muted">{a.provider} · {a.model} {a.hasKey ? "🔑" : ""}</span>
                  </span>
                  <span className="row">
                    {a.name !== cfg.defaultAgent && <button className="icon-btn" onClick={() => makeDefault(a.name)}>padrão</button>}
                    <button className="icon-btn" onClick={() => test(a.name)}>testar</button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {picking && (
          <ModelPicker
            onPick={(id) => {
              setModel(id);
              setPicking(false);
            }}
            onClose={() => setPicking(false)}
          />
        )}
      </div>
    </div>
  );
}
