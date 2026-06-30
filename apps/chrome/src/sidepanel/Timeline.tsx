/** Timeline — visualização de ações web */
import type { WebAction } from "../shared/types.js";
import { t, getLocale } from "../shared/i18n.js";

const ACTION_ICONS: Record<string, string> = {
  web_navigate: "🌐",
  web_click: "👆",
  web_type: "⌨️",
  web_extract: "📄",
  web_scroll: "📜",
  web_screenshot: "📷",
  web_get_html: "🔍",
  web_wait: "⏳",
  web_execute: "⚡",
};

interface Props {
  actions: WebAction[];
}

export function Timeline({ actions }: Props) {
  if (actions.length === 0) {
    return (
      <div
        style={{
          padding: "8px 12px",
          borderTop: "1px solid #333",
          fontSize: 12,
          color: "#666",
          textAlign: "center",
        }}
      >
        {t("timeline.empty")}
      </div>
    );
  }

  return (
    <div
      style={{
        maxHeight: 120,
        overflowY: "auto",
        borderTop: "1px solid #333",
        padding: "4px 8px",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4, textTransform: "uppercase" }}>
        {t("timeline.title")}
      </div>
      {actions.map((action) => (
        <div
          key={action.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 0",
            fontSize: 12,
            color:
              action.status === "done" ? "#4ade80" :
              action.status === "error" ? "#ef4444" :
              action.status === "running" ? "#fbbf24" :
              "#888",
          }}
        >
          <span>{ACTION_ICONS[action.tool] ?? "🔧"}</span>
          <span style={{ flex: 1 }}>
            {t(`web.${action.tool.replace("web_", "")}`, {
              url: String(action.args.url ?? ""),
              selector: String(action.args.selector ?? ""),
              direction: String(action.args.direction ?? ""),
              ms: Number(action.args.ms ?? 0),
            })}
          </span>
          <span style={{ fontSize: 10 }}>
            {action.status === "running" ? "..." : action.status === "done" ? "✓" : action.status === "error" ? "✗" : ""}
          </span>
        </div>
      ))}
    </div>
  );
}