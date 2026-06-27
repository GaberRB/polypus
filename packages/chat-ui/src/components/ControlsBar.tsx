/**
 * The run-controls bar (VA2-VA5): execution mode, model switcher, execution
 * profile, and clear-conversation. Every control maps to a real CLI flag — no
 * decorative toggles (RNF1). Mode/profile changes take effect on the next run.
 */
import { useEffect, useState } from "react";
import type { AgentInfo, ChatTransport, Mode, Profile, RunControls } from "../transport.js";

/** Icon + label + hint per execution mode (shared with the input indicator). */
export const MODE_META: Record<Mode, { icon: string; label: string; hint: string }> = {
  review: { icon: "✋", label: "Ask before edits", hint: "Pede aprovação antes de editar" },
  bypass: { icon: "</>", label: "Edit automatically", hint: "Aplica edições sem perguntar" },
  plan: { icon: "▤", label: "Plan mode", hint: "Planeja antes de tocar no código" },
};

const MODES: Mode[] = ["review", "bypass", "plan"];

export function ControlsBar({
  controls,
  onChange,
  transport,
  onClear,
  disabled = false,
}: {
  controls: RunControls;
  onChange: (next: RunControls) => void;
  transport: ChatTransport;
  onClear: () => void;
  disabled?: boolean;
}): JSX.Element {
  const [agents, setAgents] = useState<AgentInfo[]>([]);

  useEffect(() => {
    void transport.listAgents().then(setAgents).catch(() => setAgents([]));
  }, [transport]);

  const activeAgent = controls.agent ?? agents.find((a) => a.isDefault)?.name;

  return (
    <div className="controls-bar">
      {/* Modes (VA2) */}
      <div className="mode-group" role="radiogroup" aria-label="Modo de execução">
        {MODES.map((m) => {
          const meta = MODE_META[m];
          const active = controls.mode === m;
          return (
            <button
              key={m}
              className={`mode-btn${active ? " mode-btn--active" : ""}`}
              role="radio"
              aria-checked={active}
              title={meta.hint}
              disabled={disabled}
              onClick={() => onChange({ ...controls, mode: m })}
            >
              <span className="mode-icon" aria-hidden>{meta.icon}</span>
              <span className="mode-label">{meta.label}</span>
            </button>
          );
        })}
      </div>

      <div className="controls-spacer" />

      {/* Model switcher (VA3) */}
      {agents.length > 0 && (
        <label className="control-select" title="Trocar modelo/agente">
          <span className="control-select-icon" aria-hidden>◇</span>
          <select
            aria-label="Modelo"
            value={activeAgent ?? ""}
            disabled={disabled}
            onChange={(e) => onChange({ ...controls, agent: e.target.value || undefined })}
          >
            {agents.map((a) => (
              <option key={a.name} value={a.name}>
                {a.name} · {a.model}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Profile / effort (VA4) */}
      <label className="control-select" title="Esforço / perfil de execução">
        <span className="control-select-icon" aria-hidden>⚡</span>
        <select
          aria-label="Perfil"
          value={controls.profile ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ ...controls, profile: (e.target.value || undefined) as Profile | undefined })}
        >
          <option value="">Padrão</option>
          <option value="fast">Rápido</option>
          <option value="quality">Qualidade</option>
        </select>
      </label>

      {/* Clear conversation (VA5) */}
      <button className="control-icon-btn" title="Limpar conversa" aria-label="Limpar conversa" onClick={onClear}>
        🗑
      </button>
    </div>
  );
}
