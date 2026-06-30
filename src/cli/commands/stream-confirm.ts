import type { ConfirmRequest, ConfirmResult } from "../../core/permissions/modes.js";

/**
 * Bidirectional permission-confirm protocol for the NDJSON stream
 * (`run --json --stream`), mirroring the stream-ask.ts pattern.
 *
 * When the CLI needs user approval in review mode (write_file, run_command, …),
 * it normally shows a TUI diff prompt. In streaming mode there is no TTY —
 * instead we emit a `confirm` event to stdout and block until the host writes a
 * matching `confirm_response` line to stdin. This lets the VSCode extension
 * render an Approve/Deny dialog and feed the result back to the waiting CLI.
 */
export interface StreamConfirm {
  /** Wired into PermissionEngine as `confirm`. Resolves true=approve, false=deny. */
  confirm: (req: ConfirmRequest) => Promise<ConfirmResult>;
  /** Feed one line read from stdin; resolves the matching pending confirm. */
  handleLine: (line: string) => void;
  /** Resolve every pending confirm with false (deny) on abort / process exit. */
  dispose: () => void;
}

/** Event emitted to the host asking for approval. */
interface ConfirmEvent {
  type: "confirm";
  id: number;
  kind: "write" | "command" | "network";
  summary: string;
  preview?: string;
}

/** The host's reply, correlated by `id`. ok=true → approve all; ok=false → deny. */
interface ConfirmResponse {
  type: "confirm_response";
  id: number;
  ok: boolean;
}

function isConfirmResponse(v: unknown): v is ConfirmResponse {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return o.type === "confirm_response" && typeof o.id === "number" && typeof o.ok === "boolean";
}

export function createStreamConfirm(emit: (event: ConfirmEvent) => void): StreamConfirm {
  const pending = new Map<number, (value: ConfirmResult) => void>();
  let nextId = 1;

  return {
    confirm(req) {
      const id = nextId++;
      const event: ConfirmEvent = {
        type: "confirm",
        id,
        kind: req.kind,
        summary: req.summary,
        preview: req.preview,
      };
      return new Promise<ConfirmResult>((resolve) => {
        pending.set(id, resolve);
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
      resolve(parsed.ok);
    },

    dispose() {
      for (const resolve of pending.values()) resolve(false);
      pending.clear();
    },
  };
}
