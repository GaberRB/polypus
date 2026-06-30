/** ConfirmCard — card de confirmação para modo review */
import { t } from "../shared/i18n.js";

interface Props {
  action: string;
  target?: string;
  summary: string;
  onApprove: () => void;
  onReject: () => void;
}

export function ConfirmCard({ action, target, summary, onApprove, onReject }: Props) {
  return (
    <div
      style={{
        padding: "10px 12px",
        borderTop: "1px solid #7A4ADE",
        borderBottom: "1px solid #7A4ADE",
        backgroundColor: "rgba(122,74,222,.1)",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: "#cdb6fd" }}>
        {t("confirm.title")}
      </div>
      <div style={{ fontSize: 13, marginBottom: 4 }}>
        {t("confirm.action", { action })}:
      </div>
      <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>
        <em>{summary}</em>
      </div>
      {target && (
        <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>
          {t("confirm.target", { target })}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onApprove}
          style={{
            flex: 1,
            padding: "6px 12px",
            borderRadius: 6,
            border: "none",
            backgroundColor: "#4ade80",
            color: "#000",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          {t("confirm.approve")}
        </button>
        <button
          onClick={onReject}
          style={{
            flex: 1,
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid #555",
            backgroundColor: "transparent",
            color: "#ccc",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          {t("confirm.reject")}
        </button>
      </div>
    </div>
  );
}