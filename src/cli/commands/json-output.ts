import type { AgentEvents, RunResult } from "../../core/agent/loop.js";

export interface JsonEvent {
  type: "step" | "assistant" | "tool_call" | "tool_result" | "correction" | "reprompt" | "compaction";
  [key: string]: unknown;
}

export interface JsonCollector {
  /** AgentEvents that record a structured log instead of rendering to a TTY. */
  events: AgentEvents;
  /** Build the final JSON payload from the run result plus the collected log. */
  build(result: RunResult): {
    result: {
      reason: RunResult["reason"];
      finished: boolean;
      steps: number;
      summary?: string;
      filesChanged: string[];
      usage: RunResult["usage"];
    };
    events: JsonEvent[];
  };
}

const OUTPUT_PREVIEW = 500;

/**
 * Collect agent events into a stable JSON contract for headless/CI use
 * (`polypus run "<task>" --json`). `filesChanged` is derived from successful
 * `write_file`/`edit_file` calls.
 */
export function createJsonCollector(): JsonCollector {
  const log: JsonEvent[] = [];
  const filesChanged = new Set<string>();

  const events: AgentEvents = {
    onStep(step) {
      log.push({ type: "step", step });
    },
    onAssistantText(text) {
      if (text.trim()) log.push({ type: "assistant", text });
    },
    onToolCall(call) {
      log.push({ type: "tool_call", name: call.name, arguments: call.arguments });
    },
    onToolResult(call, result) {
      log.push({
        type: "tool_result",
        name: call.name,
        ok: result.ok,
        output: result.output.slice(0, OUTPUT_PREVIEW),
      });
      if (result.ok && (call.name === "write_file" || call.name === "edit_file")) {
        const path = call.arguments.path;
        if (typeof path === "string") filesChanged.add(path);
      }
    },
    onCorrection(call) {
      log.push({ type: "correction", name: call.name });
    },
    onReprompt(attempt) {
      log.push({ type: "reprompt", attempt });
    },
    onCompaction(before, after) {
      log.push({ type: "compaction", before, after });
    },
    onUsage() {
      /* usage is summarised in the final result, not per-event */
    },
  };

  return {
    events,
    build(result) {
      return {
        result: {
          reason: result.reason,
          finished: result.finished,
          steps: result.steps,
          summary: result.summary,
          filesChanged: [...filesChanged],
          usage: result.usage,
        },
        events: log,
      };
    },
  };
}

/** A single streamed event (`polypus run --json --stream` emits one per line). */
export interface StreamEvent {
  type:
    | "step"
    | "assistant_delta"
    | "assistant"
    | "tool_call"
    | "tool_result"
    | "correction"
    | "reprompt"
    | "compaction"
    | "usage"
    | "result";
  [key: string]: unknown;
}

/**
 * Stream agent events as NDJSON (one JSON object per line) as they happen, for
 * live UIs (e.g. the Cowork desktop app). `onAssistantDelta` carries live token
 * chunks in native mode. Call `finalize(result)` to emit the closing `result`.
 */
export function createNdjsonStreamer(emit: (event: StreamEvent) => void): {
  events: AgentEvents;
  finalize(result: RunResult): void;
} {
  const filesChanged = new Set<string>();
  const events: AgentEvents = {
    onStep(step) {
      emit({ type: "step", step });
    },
    onAssistantDelta(text) {
      emit({ type: "assistant_delta", text });
    },
    onAssistantText(text) {
      if (text.trim()) emit({ type: "assistant", text });
    },
    onToolCall(call) {
      emit({ type: "tool_call", name: call.name, arguments: call.arguments });
    },
    onToolResult(call, result) {
      emit({
        type: "tool_result",
        name: call.name,
        ok: result.ok,
        output: result.output.slice(0, OUTPUT_PREVIEW),
      });
      if (result.ok && (call.name === "write_file" || call.name === "edit_file")) {
        const path = call.arguments.path;
        if (typeof path === "string") filesChanged.add(path);
      }
    },
    onCorrection(call) {
      emit({ type: "correction", name: call.name });
    },
    onReprompt(attempt) {
      emit({ type: "reprompt", attempt });
    },
    onCompaction(before, after) {
      emit({ type: "compaction", before, after });
    },
    onUsage(usage) {
      emit({ type: "usage", ...usage });
    },
  };

  return {
    events,
    finalize(result) {
      emit({
        type: "result",
        result: {
          reason: result.reason,
          finished: result.finished,
          steps: result.steps,
          summary: result.summary,
          filesChanged: [...filesChanged],
          usage: result.usage,
        },
      });
    },
  };
}
