/**
 * Collapsible reasoning/chain-of-thought block (VB3). Shown only when the model
 * actually streamed reasoning (`--think` + a reasoning-capable model). Collapsed
 * by default while running so it doesn't dominate; expandable on click.
 */
import { useState } from "react";

export function ThinkingBlock({ text, running }: { text: string; running: boolean }): JSX.Element | null {
  const [open, setOpen] = useState(false);
  if (!text) return null;

  return (
    <div className={`thinking-block${open ? " thinking-block--open" : ""}`}>
      <button
        className="thinking-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="thinking-caret" aria-hidden>{open ? "▾" : "▸"}</span>
        <span className="thinking-label">{running ? "Pensando…" : "Raciocínio"}</span>
      </button>
      {open && <pre className="thinking-text">{text}</pre>}
    </div>
  );
}
