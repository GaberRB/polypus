/** UsageBar — barra de tokens/custo */
import type { StreamEvent } from "../shared/types.js";
import { t } from "../shared/i18n.js";

interface Props {
  events: StreamEvent[];
}

export function UsageBar({ events }: Props) {
  const usageEvents = events.filter((e): e is StreamEvent & { type: "usage" } => e.type === "usage");
  const last = usageEvents[usageEvents.length - 1];

  if (!last) {
    return (
      <div
        style={{
          padding: "4px 12px",
          borderTop: "1px solid #333",
          fontSize: 11,
          color: "#555",
          textAlign: "right",
        }}
      >
        waiting…
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "4px 12px",
        borderTop: "1px solid #333",
        fontSize: 11,
        color: "#888",
        textAlign: "right",
        display: "flex",
        justifyContent: "flex-end",
        gap: 12,
      }}
    >
      <span>{t("usage.tokens", { total: last.tokensIn + last.tokensOut })}</span>
      <span>{t("usage.cost", { cost: `$${last.costUsd.toFixed(4)}` })}</span>
    </div>
  );
}