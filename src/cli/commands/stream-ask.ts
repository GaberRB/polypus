import type { AskRequest } from "../../core/tools/types.js";

/**
 * Bidirectional `ask_user` protocol for the NDJSON stream (`run --json --stream`).
 *
 * When the agent calls the `ask_user` tool, the CLI normally needs a TTY picker.
 * In streaming mode there is no TTY — instead we emit an `ask_user` event to
 * stdout and block until the host (e.g. the Cowork desktop) writes a matching
 * `ask_response` line to the child's stdin. This lets a GUI render a clickable
 * choice card and feed the user's selection back to the waiting agent.
 *
 * The factory is decoupled from `process` (it takes an `emit` and is fed stdin
 * lines via `handleLine`) so it can be unit-tested without spawning anything.
 */
export interface StreamAsk {
  /** Wired into runAgent as `ask`. Resolves with the selected option(s), or null if dismissed. */
  ask: (req: AskRequest) => Promise<string[] | null>;
  /** Feed one line read from stdin; resolves the matching pending question. */
  handleLine: (line: string) => void;
  /** Resolve every pending question with null (on abort / process exit). */
  dispose: () => void;
}

/** A streamed prompt asking the host to render a choice and respond. */
interface AskUserEvent {
  type: "ask_user";
  id: number;
  question: string;
  options: string[];
  multi: boolean;
}

/** The host's reply, correlated by `id`. `selected: null` means dismissed. */
interface AskResponse {
  type: "ask_response";
  id: number;
  selected: string[] | null;
}

function isAskResponse(v: unknown): v is AskResponse {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    o.type === "ask_response" &&
    typeof o.id === "number" &&
    (o.selected === null || (Array.isArray(o.selected) && o.selected.every((s) => typeof s === "string")))
  );
}

export function createStreamAsk(emit: (event: AskUserEvent) => void): StreamAsk {
  const pending = new Map<number, (value: string[] | null) => void>();
  let nextId = 1;

  return {
    ask(req) {
      const id = nextId++;
      const event: AskUserEvent = {
        type: "ask_user",
        id,
        question: req.question,
        options: req.options,
        multi: Boolean(req.multi),
      };
      return new Promise<string[] | null>((resolve) => {
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
        return; // ignore non-JSON noise
      }
      if (!isAskResponse(parsed)) return;
      const resolve = pending.get(parsed.id);
      if (!resolve) return;
      pending.delete(parsed.id);
      resolve(parsed.selected);
    },

    dispose() {
      for (const resolve of pending.values()) resolve(null);
      pending.clear();
    },
  };
}
