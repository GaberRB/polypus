import { useEffect, useRef, useState } from "react";

export interface Command {
  id: string;
  label: string;
  icon: string;
  group: string;
  action: () => void;
  keywords?: string[];
}

function filterCommands(commands: Command[], query: string): Command[] {
  if (!query) return commands;
  const q = query.toLowerCase();
  return commands
    .filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.keywords?.some((k) => k.toLowerCase().includes(q)),
    )
    .sort((a, b) => {
      const aStart = a.label.toLowerCase().startsWith(q) ? 0 : 1;
      const bStart = b.label.toLowerCase().startsWith(q) ? 0 : 1;
      return aStart - bStart;
    });
}

export function CommandPalette({
  commands,
  onClose,
}: {
  commands: Command[];
  onClose: () => void;
}): JSX.Element {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = filterCommands(commands, query);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const run = (cmd: Command): void => {
    onClose();
    cmd.action();
  };

  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[activeIdx];
      if (cmd) run(cmd);
    }
  };

  const groups = [...new Set(filtered.map((c) => c.group))];

  return (
    <div className="cmd-palette-overlay" onClick={onClose}>
      <div
        className="cmd-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Palette de comandos"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKey}
      >
        <input
          ref={inputRef}
          className="cmd-palette-input"
          placeholder="Buscar ação… (Cmd+K)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar comandos"
          autoComplete="off"
        />
        <div ref={listRef} className="cmd-palette-list" role="listbox">
          {filtered.length === 0 && (
            <div className="cmd-palette-empty">Nenhum resultado para "{query}"</div>
          )}
          {groups.map((group) => (
            <div key={group}>
              <div className="cmd-group-label">{group}</div>
              {filtered
                .filter((c) => c.group === group)
                .map((cmd) => {
                  const idx = filtered.indexOf(cmd);
                  return (
                    <button
                      key={cmd.id}
                      className={`cmd-item${idx === activeIdx ? " cmd-item--active" : ""}`}
                      role="option"
                      aria-selected={idx === activeIdx}
                      onClick={() => run(cmd)}
                      onMouseEnter={() => setActiveIdx(idx)}
                    >
                      <span className="cmd-item-icon" aria-hidden>{cmd.icon}</span>
                      <span className="cmd-item-label">{cmd.label}</span>
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
