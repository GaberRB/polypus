/** PermissionBar — seletor de modo de permissão e allow-list */
import { t } from "../shared/i18n.js";
import type { WebPermissions } from "../shared/types.js";

interface Props {
  permissions: WebPermissions;
  onChange: (perms: WebPermissions) => void;
}

const MODES = ["plan", "review", "bypass"] as const;

export function PermissionBar({ permissions, onChange }: Props) {
  const setMode = (mode: WebPermissions["mode"]) => {
    onChange({ ...permissions, mode });
  };

  const addDomain = (list: "allowList" | "blockList") => {
    const domain = prompt(t("permission.addDomain"));
    if (domain?.trim()) {
      onChange({
        ...permissions,
        [list]: [...permissions[list], domain.trim()],
      });
    }
  };

  const removeDomain = (list: "allowList" | "blockList", idx: number) => {
    onChange({
      ...permissions,
      [list]: permissions[list].filter((_, i) => i !== idx),
    });
  };

  return (
    <div
      style={{
        padding: "6px 12px",
        borderBottom: "1px solid #333",
        backgroundColor: "#16213e",
        fontSize: 12,
      }}
    >
      <div style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
        <span style={{ color: "#888", marginRight: 4 }}>{t("permission.mode")}:</span>
        {MODES.map((mode) => (
          <button
            key={mode}
            onClick={() => setMode(mode)}
            style={{
              padding: "2px 8px",
              borderRadius: 6,
              border: "1px solid",
              borderColor: permissions.mode === mode ? "#7A4ADE" : "#444",
              backgroundColor: permissions.mode === mode ? "rgba(122,74,222,.2)" : "transparent",
              color: permissions.mode === mode ? "#cdb6fd" : "#888",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: permissions.mode === mode ? 600 : 400,
            }}
          >
            {t(`permission.${mode}`)}
          </button>
        ))}
      </div>

      {/* Domains */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(["allowList", "blockList"] as const).map((list) => (
          <div key={list} style={{ flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: 10, color: "#666", marginBottom: 2 }}>
              {t(`permission.${list}`)}
            </div>
            {permissions[list].map((domain, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                <span style={{ fontSize: 11, color: list === "allowList" ? "#4ade80" : "#ef4444" }}>
                  {domain}
                </span>
                <button
                  onClick={() => removeDomain(list, i)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#666",
                    cursor: "pointer",
                    fontSize: 10,
                    padding: 0,
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={() => addDomain(list)}
              style={{
                background: "none",
                border: "1px dashed #555",
                borderRadius: 4,
                color: "#888",
                cursor: "pointer",
                fontSize: 10,
                padding: "1px 6px",
                marginTop: 2,
              }}
            >
              +
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}