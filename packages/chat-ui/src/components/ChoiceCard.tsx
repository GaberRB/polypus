/**
 * Renders an `ask_user` prompt as a clickable choice card. Single-select submits
 * on click; multi-select accumulates and submits via the confirm button. Once
 * `prompt.answered` is set the card locks and shows the selection.
 */
import { useState } from "react";
import type { AskPrompt } from "../reducer.js";

export function ChoiceCard({
  prompt,
  onSubmit,
}: {
  prompt: AskPrompt;
  onSubmit: (selected: string[]) => void;
}): JSX.Element {
  const [picked, setPicked] = useState<string[]>([]);
  const locked = prompt.answered !== undefined;

  const toggle = (opt: string): void => {
    if (locked) return;
    if (prompt.multi) {
      setPicked((prev) => (prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]));
    } else {
      onSubmit([opt]); // single-select: choosing is answering
    }
  };

  return (
    <div className="choice-card" role="group" aria-label={prompt.question}>
      <div className="choice-question">{prompt.question}</div>
      <div className="choice-options">
        {prompt.options.map((opt) => {
          const isAnswered = locked && prompt.answered!.includes(opt);
          const isPicked = !locked && prompt.multi && picked.includes(opt);
          return (
            <button
              key={opt}
              className={`choice-option${isAnswered ? " choice-option--answered" : ""}${isPicked ? " choice-option--picked" : ""}`}
              onClick={() => toggle(opt)}
              disabled={locked}
              aria-pressed={prompt.multi ? isPicked || isAnswered : undefined}
            >
              {prompt.multi && <span className="choice-check" aria-hidden>{isPicked || isAnswered ? "☑" : "☐"}</span>}
              {opt}
            </button>
          );
        })}
      </div>
      {prompt.multi && !locked && (
        <button className="choice-confirm" onClick={() => onSubmit(picked)} disabled={picked.length === 0}>
          Confirmar
        </button>
      )}
    </div>
  );
}
