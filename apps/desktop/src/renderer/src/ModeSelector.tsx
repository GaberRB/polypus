import type { Mode } from "../../shared/ipc";

const MODES: { id: Mode; hint: string }[] = [
  { id: "plan", hint: "só planeja, não altera nada" },
  { id: "review", hint: "pausa e pede aprovação a cada mudança" },
  { id: "bypass", hint: "aplica tudo sem perguntar" },
];

/** Segmented control for the permission mode (plan/review/bypass). */
export function ModeSelector({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }): JSX.Element {
  return (
    <span className="modes" role="group" aria-label="modo de permissão">
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          className={`mode-btn${m.id === mode ? " mode-on" : ""}`}
          title={m.hint}
          aria-pressed={m.id === mode}
          onClick={() => onChange(m.id)}
        >
          {m.id}
        </button>
      ))}
    </span>
  );
}
