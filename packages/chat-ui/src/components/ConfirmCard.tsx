/**
 * Permission-approval card (the fix that makes "Ask before edits" usable). When
 * the agent wants to write a file / run a command / hit the network in review
 * mode, the CLI streams a `confirm_request`; this renders the summary (and the
 * diff for writes) with Approve / Reject. Locks once the user decides.
 */
import type { ConfirmPrompt } from "../reducer.js";
import { DiffViewer } from "./DiffViewer.js";

const KIND_META: Record<ConfirmPrompt["kind"], { icon: string; label: string }> = {
  write: { icon: "✎", label: "Escrever arquivo" },
  command: { icon: "⊡", label: "Rodar comando" },
  network: { icon: "🌐", label: "Acesso à rede" },
};

export function ConfirmCard({
  prompt,
  onDecide,
}: {
  prompt: ConfirmPrompt;
  onDecide: (approved: boolean) => void;
}): JSX.Element {
  const meta = KIND_META[prompt.kind];
  const locked = prompt.answered !== undefined;

  return (
    <div className={`confirm-card confirm-card--${prompt.kind}`} role="group" aria-label={meta.label}>
      <div className="confirm-head">
        <span className="confirm-icon" aria-hidden>{meta.icon}</span>
        <span className="confirm-summary">{prompt.summary || meta.label}</span>
      </div>

      {prompt.diff && <DiffViewer diff={prompt.diff} />}
      {!prompt.diff && prompt.preview && <pre className="confirm-preview">{prompt.preview}</pre>}

      {locked ? (
        <div className={`confirm-result ${prompt.answered ? "confirm-result--ok" : "confirm-result--no"}`}>
          {prompt.answered ? "✓ Aprovado" : "✕ Rejeitado"}
        </div>
      ) : (
        <div className="confirm-actions">
          <button className="confirm-approve" onClick={() => onDecide(true)}>Aprovar</button>
          <button className="confirm-reject" onClick={() => onDecide(false)}>Rejeitar</button>
        </div>
      )}
    </div>
  );
}
