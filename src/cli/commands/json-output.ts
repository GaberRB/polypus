import type { AgentEvents, RunResult } from "../../core/agent/loop.js";

export type JsonEvent =
  | { type: "step"; step: number }
  | { type: "assistant"; text: string }
  | { type: "tool_call"; name: string; arguments: Record<string, unknown> }
  | { type: "tool_result"; name: string; ok: boolean; output: string }
  | { type: "hook_event"; event: string; toolName: string | null; command: string; durationMs: number; blocked: boolean; output: string }
  | { type: "correction"; name: string }
  | { type: "reprompt"; attempt: number }
  | { type: "compaction"; before: number; after: number };

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
    onHook(event, toolName, result) {
      log.push({
        type: "hook_event",
        event,
        toolName,
        command: result.command,
        durationMs: result.durationMs,
        blocked: result.blocked,
        output: result.output.slice(0, OUTPUT_PREVIEW),
      });
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
export type StreamEvent =
  | { type: "step"; step: number }
  | { type: "assistant_delta"; text: string }
  | { type: "thinking_delta"; text: string }
  | { type: "assistant"; text: string }
  | { type: "tool_call"; name: string; arguments: Record<string, unknown> }
  | { type: "tool_result"; name: string; ok: boolean; output: string }
  | { type: "hook_event"; event: string; toolName: string | null; command: string; durationMs: number; blocked: boolean; output: string }
  | { type: "ask_user"; [key: string]: unknown }
  | { type: "correction"; name: string }
  | { type: "reprompt"; attempt: number }
  | { type: "compaction"; before: number; after: number }
  | { type: "usage"; promptTokens: number; completionTokens: number }
  | { type: "result"; result: Record<string, unknown> };

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
    onThinkingDelta(text) {
      emit({ type: "thinking_delta", text });
    },
    onAssistantText(text) {
      if (text.trim()) emit({ type: "assistant", text });
    },
    onToolCall(call) {
      // ask_user is surfaced as a dedicated `ask_user` event (the interactive
      // card), so skip the generic timeline row to avoid a duplicate entry.
      if (call.name === "ask_user") return;
      emit({ type: "tool_call", name: call.name, arguments: call.arguments });
    },
    onToolResult(call, result) {
      if (call.name === "ask_user") return; // see onToolCall above
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
    onHook(event, toolName, result) {
      emit({
        type: "hook_event",
        event,
        toolName,
        command: result.command,
        durationMs: result.durationMs,
        blocked: result.blocked,
        output: result.output.slice(0, OUTPUT_PREVIEW),
      });
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
