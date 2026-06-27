import type { ConfirmRequest, ConfirmResult } from "../../core/permissions/modes.js";
import type { Hunk } from "../../core/permissions/diff.js";

/**
 * Bidirectional permission-confirmation protocol for the NDJSON stream
 * (`run --json --stream`). Mirrors `stream-ask`: in review mode the permission
 * engine asks before each write/command/network action, but a headless `--json`
 * run has no TTY. Instead we emit a `confirm_request` event and block until the
 * host (the VSCode panel) writes a matching `confirm_response` line to stdin —
 * so the user can approve/reject from the UI. Without this, review mode would
 * deny everything (the old `() => false` behaviour).
 */
export interface StreamConfirm {
  /** Wired into the PermissionEngine as `confirm`. */
  confirm: (req: ConfirmRequest) => Promise<ConfirmResult>;
  /** Feed one stdin line; resolves the matching pending confirmation. */
  handleLine: (line: string) => void;
  /** Reject every pending confirmation (on abort / exit). */
  dispose: () => void;
}

/** A streamed request asking the host to approve/reject an action. */
interface ConfirmRequestEvent {
  type: "confirm_request";
  id: number;
  kind: ConfirmRequest["kind"];
  summary: string;
  preview?: string;
  /** A unified diff (for writes), so the panel can show the change. */
  diff?: string;
}

interface ConfirmResponse {
  type: "confirm_response";
  id: number;
  approved: boolean;
}

function isConfirmResponse(v: unknown): v is ConfirmResponse {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return o.type === "confirm_response" && typeof o.id === "number" && typeof o.approved === "boolean";
}

/** Render hunks as a unified-diff string the chat UI's DiffViewer understands. */
function renderDiff(hunks: Hunk[]): string {
  const out: string[] = [];
  for (const h of hunks) {
    out.push(`@@ -${h.oldStart + 1},${h.oldCount} +${h.newStart + 1},${h.newCount} @@`);
    for (const l of h.lines) {
      const sign = l.type === "+" ? "+" : l.type === "-" ? "-" : " ";
      out.push(`${sign}${l.text}`);
    }
  }
  return out.join("\n");
}

export function createStreamConfirm(emit: (event: ConfirmRequestEvent) => void): StreamConfirm {
  const pending = new Map<number, (approved: boolean) => void>();
  let nextId = 1;

  return {
    confirm(req) {
      const id = nextId++;
      const event: ConfirmRequestEvent = {
        type: "confirm_request",
        id,
        kind: req.kind,
        summary: req.summary,
        ...(req.preview ? { preview: req.preview } : {}),
        ...(req.hunks && req.hunks.length > 0 ? { diff: renderDiff(req.hunks) } : {}),
      };
      return new Promise<ConfirmResult>((resolve) => {
        pending.set(id, (approved) => resolve(approved));
        emit(event);
      });
    },

    handleLine(line) {
      const trimmed = line.trim();
      if (!trimmed) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        return;
      }
      if (!isConfirmResponse(parsed)) return;
      const resolve = pending.get(parsed.id);
      if (!resolve) return;
      pending.delete(parsed.id);
      resolve(parsed.approved);
    },

    dispose() {
      for (const resolve of pending.values()) resolve(false); // deny anything still pending
      pending.clear();
    },
  };
}
