import { useSettings } from "./settings";
import type { Mode } from "../../shared/ipc";
import type { StringKey } from "./i18n";

const MODES: Mode[] = ["plan", "review", "bypass"];
const HINT: Record<Mode, StringKey> = {
  plan: "mode.plan.hint",
  review: "mode.review.hint",
  bypass: "mode.bypass.hint",
};

/** Segmented control for the permission mode (plan/review/bypass). */
export function ModeSelector({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }): JSX.Element {
  const { t } = useSettings();
  return (
    <span className="modes" role="group" aria-label={t("ctx.mode")}>
      {MODES.map((id) => (
        <button
          key={id}
          type="button"
          className={`mode-btn${id === mode ? " mode-on" : ""}`}
          title={t(HINT[id])}
          aria-pressed={id === mode}
          onClick={() => onChange(id)}
        >
          {id}
        </button>
      ))}
    </span>
  );
}
