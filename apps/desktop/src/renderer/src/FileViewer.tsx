import { useEffect, useRef, useState } from "react";
import { useSettings } from "./settings";
import { translate } from "./i18n";

interface Props {
  path: string | null;
  onClose: () => void;
}

export function FileViewer({ path, onClose }: Props): JSX.Element | null {
  const { lang } = useSettings();
  const t = (k: Parameters<typeof translate>[1]) => translate(lang, k);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  const filename = path ? path.replace(/\\/g, "/").split("/").pop() ?? path : "";

  useEffect(() => {
    if (!path) {
      setContent(null);
      setError(null);
      return;
    }
    setLoading(true);
    setContent(null);
    setError(null);
    void window.polypus?.fileRead(path).then((res) => {
      setLoading(false);
      if (res.ok) setContent(res.data);
      else setError(res.error);
    });
  }, [path]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  if (!path) return null;

  return (
    <>
      <div
        ref={backdropRef}
        className="file-drawer-backdrop"
        onClick={handleBackdropClick}
      />
      <div className={`file-drawer open`} role="dialog" aria-label={filename}>
        <div className="file-drawer-head">
          <span className="file-drawer-title" title={path}>
            {filename}
          </span>
          <button
            className="icon-btn"
            onClick={onClose}
            aria-label={t("file.close")}
            title={t("file.close")}
          >
            ✕
          </button>
        </div>
        <div className="file-drawer-body">
          {loading && (
            <div style={{ padding: "8px 0" }}>
              {Array.from({ length: 8 }, (_, i) => (
                <div
                  key={i}
                  className="skeleton"
                  style={{ height: 14, marginBottom: 6, width: `${60 + (i % 3) * 15}%` }}
                />
              ))}
            </div>
          )}
          {error && <span className="muted">{t("file.error")} {error}</span>}
          {content !== null && <pre>{content}</pre>}
        </div>
      </div>
    </>
  );
}
