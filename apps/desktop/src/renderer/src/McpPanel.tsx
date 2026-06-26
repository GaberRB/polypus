import { useEffect, useState } from "react";
import { useSettings } from "./settings";
import type { McpServerEntry, McpToolInfo } from "../../shared/ipc";

interface EnvRow {
  key: string;
  value: string;
}

interface FormState {
  name: string;
  command: string;
  args: string;
  envRows: EnvRow[];
}

const EMPTY_FORM: FormState = { name: "", command: "", args: "", envRows: [] };

function parseEnvRows(rows: EnvRow[]): Record<string, string> {
  const env: Record<string, string> = {};
  for (const { key, value } of rows) {
    if (key.trim()) env[key.trim()] = value;
  }
  return env;
}

export function McpPanel({ dir }: { dir: string | null }): JSX.Element {
  const { t } = useSettings();
  const [servers, setServers] = useState<McpServerEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [testingServer, setTestingServer] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, McpToolInfo[] | string>>({});

  const load = async (): Promise<void> => {
    if (!dir) return;
    const res = await window.polypus?.mcpList(dir);
    if (res?.ok) setServers(res.data);
  };

  useEffect(() => {
    void load();
    setTestResults({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dir]);

  if (!dir) {
    return <p className="muted mcp-no-project">{t("mcp.noProject")}</p>;
  }

  const saveServers = async (next: McpServerEntry[]): Promise<void> => {
    setSaving(true);
    const res = await window.polypus?.mcpSave(dir, next);
    setSaving(false);
    if (!res?.ok) {
      setStatus(res?.error ?? "Falha ao salvar.");
      return;
    }
    setServers(next);
    setStatus("");
  };

  const addServer = async (): Promise<void> => {
    const name = form.name.trim();
    const command = form.command.trim();
    if (!name || !command) {
      setStatus("Nome e Comando são obrigatórios.");
      return;
    }
    if (servers.some((s) => s.name === name)) {
      setStatus(`Servidor "${name}" já existe.`);
      return;
    }
    const entry: McpServerEntry = {
      name,
      command,
      args: form.args.trim() ? form.args.trim().split(/\s+/) : [],
      env: parseEnvRows(form.envRows),
    };
    await saveServers([...servers, entry]);
    setForm(EMPTY_FORM);
    setShowForm(false);
  };

  const removeServer = async (name: string): Promise<void> => {
    await saveServers(servers.filter((s) => s.name !== name));
    setConfirmRemove(null);
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const testServer = async (entry: McpServerEntry): Promise<void> => {
    setTestingServer(entry.name);
    setTestResults((prev) => ({ ...prev, [entry.name]: [] }));
    const res = await window.polypus?.mcpTestServer(entry);
    setTestingServer(null);
    if (!res?.ok) {
      setTestResults((prev) => ({ ...prev, [entry.name]: res?.error ?? "Erro ao testar." }));
    } else {
      setTestResults((prev) => ({ ...prev, [entry.name]: res.data }));
    }
  };

  const updateEnvRow = (idx: number, field: "key" | "value", val: string): void => {
    setForm((f) => {
      const envRows = [...f.envRows];
      envRows[idx] = { ...envRows[idx]!, [field]: val };
      return { ...f, envRows };
    });
  };

  return (
    <div className="mcp-panel">
      <div className="mcp-header">
        <strong>{t("mcp.title")}</strong>
        {status && <span className="muted mcp-status">{status}</span>}
      </div>

      {servers.length === 0 && !showForm && (
        <p className="muted">{t("mcp.empty")}</p>
      )}

      {servers.map((server) => {
        const toolResult = testResults[server.name];
        const isTesting = testingServer === server.name;

        return (
          <div key={server.name} className="mcp-server-block">
            <div className="mcp-server-row">
              <div className="mcp-server-info">
                <span className="mcp-server-name">{server.name}</span>
                <span className="mcp-server-cmd muted">
                  {server.command} {server.args.join(" ")}
                </span>
              </div>
              <div className="row">
                <button
                  className="icon-btn"
                  onClick={() => testServer(server)}
                  disabled={isTesting}
                >
                  {isTesting ? t("mcp.testing") : t("mcp.test")}
                </button>
                {confirmRemove === server.name ? (
                  <span className="mcp-confirm-row">
                    <span className="muted">{t("mcp.confirm")}</span>
                    <button
                      className="icon-btn"
                      style={{ color: "#ffb4c4" }}
                      onClick={() => removeServer(server.name)}
                    >
                      {t("mcp.remove")}
                    </button>
                    <button className="icon-btn" onClick={() => setConfirmRemove(null)}>
                      {t("mcp.cancel")}
                    </button>
                  </span>
                ) : (
                  <button className="icon-btn" onClick={() => setConfirmRemove(server.name)}>
                    🗑
                  </button>
                )}
              </div>
            </div>

            {toolResult !== undefined && (
              <div className="mcp-tool-list">
                {typeof toolResult === "string" ? (
                  <span className="muted">{toolResult}</span>
                ) : toolResult.length === 0 ? (
                  <span className="muted">{t("mcp.noTools")}</span>
                ) : (
                  <>
                    <span className="muted">{toolResult.length} {t("mcp.tools")}:</span>
                    {toolResult.map((tool) => (
                      <span key={tool.name} className="pill" title={tool.description}>
                        {tool.name}
                      </span>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {!showForm && (
        <button className="btn mcp-add-btn" onClick={() => setShowForm(true)}>
          {t("mcp.add")}
        </button>
      )}

      {showForm && (
        <div className="mcp-form">
          <div className="field">
            <label>{t("mcp.name")}</label>
            <input
              className="composer-input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="testsprite"
            />
          </div>

          <div className="field">
            <label>{t("mcp.command")}</label>
            <input
              className="composer-input"
              value={form.command}
              onChange={(e) => setForm((f) => ({ ...f, command: e.target.value }))}
              placeholder="node"
            />
          </div>

          <div className="field">
            <label>{t("mcp.args")} <span className="muted">({t("mcp.argsHint")})</span></label>
            <input
              className="composer-input"
              value={form.args}
              onChange={(e) => setForm((f) => ({ ...f, args: e.target.value }))}
              placeholder="mcp-testsprite.js --port 3000"
            />
          </div>

          <div className="field">
            <label>{t("mcp.env")}</label>
            {form.envRows.map((row, idx) => (
              <div key={idx} className="mcp-env-row">
                <input
                  className="composer-input"
                  placeholder="CHAVE"
                  value={row.key}
                  onChange={(e) => updateEnvRow(idx, "key", e.target.value)}
                  style={{ flex: "0 0 120px" }}
                />
                <input
                  className="composer-input"
                  placeholder="valor"
                  value={row.value}
                  onChange={(e) => updateEnvRow(idx, "value", e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
            ))}
            <button
              className="icon-btn"
              onClick={() =>
                setForm((f) => ({ ...f, envRows: [...f.envRows, { key: "", value: "" }] }))
              }
            >
              {t("mcp.addEnv")}
            </button>
          </div>

          <div className="row">
            <button className="btn" onClick={addServer} disabled={saving}>
              {saving ? "salvando…" : t("mcp.save")}
            </button>
            <button
              className="icon-btn"
              onClick={() => {
                setForm(EMPTY_FORM);
                setShowForm(false);
                setStatus("");
              }}
            >
              {t("mcp.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
