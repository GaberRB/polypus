import { makeDriver } from "../protocol/emulated.js";
import type { PromptContext } from "../protocol/system-prompt.js";
import type { PermissionEngine } from "../permissions/modes.js";
import type { ResolvedAgent } from "../providers/registry.js";
import type { ChatParams, Message, ToolCall } from "../providers/types.js";
import { getTool, toolSpecs } from "../tools/registry.js";
import type { ToolResult } from "../tools/types.js";

export interface Usage {
  promptTokens: number;
  completionTokens: number;
}

export interface AgentEvents {
  onAssistantText?(text: string): void;
  onToolCall?(call: ToolCall): void;
  onToolResult?(call: ToolCall, result: ToolResult): void;
  onReprompt?(attempt: number): void;
  onStep?(step: number): void;
  /** Cumulative token usage so far this run. */
  onUsage?(usage: Usage): void;
}

export interface RunOptions {
  task: string;
  workspace: string;
  agent: ResolvedAgent;
  permissions: PermissionEngine;
  promptContext: PromptContext;
  params?: ChatParams;
  maxSteps?: number;
  maxReprompts?: number;
  /** Stop after this many consecutive identical tool failures (default 3). */
  maxToolRetries?: number;
  /** Abort the run (e.g. user pressed ESC). */
  signal?: AbortSignal;
  events?: AgentEvents;
  /** Seed history (used to continue an interactive session). */
  history?: Message[];
}

export type RunReason = "finished" | "reply" | "stalled" | "maxsteps" | "cancelled";

export interface RunResult {
  finished: boolean;
  /** Why the turn ended: completed, a plain conversational reply, a stall, or step limit. */
  reason: RunReason;
  summary?: string;
  steps: number;
  messages: Message[];
  usage: Usage;
}

/**
 * Heuristic: does a no-tool-call response look like the model refusing or merely
 * promising action (a stall worth nudging), as opposed to normal conversation?
 */
function looksLikeStall(text: string): boolean {
  const lc = text.toLowerCase();
  const markers = [
    "i can't", "i cannot", "i can not", "i'm unable", "i am unable", "unable to",
    "cannot create", "can't create", "cannot write", "can't write", "not allowed",
    "i'll create", "i will create", "let me create", "i'll write", "i will write",
    "não posso", "nao posso", "não consigo", "nao consigo", "não tenho permiss",
    "nao tenho permiss", "não é possível", "nao e possivel", "vou criar", "irei criar",
    "vou escrever", "deixe-me", "deixa eu",
  ];
  return markers.some((m) => lc.includes(m));
}

/** Drive one task to completion (or until limits are hit). */
export async function runAgent(opts: RunOptions): Promise<RunResult> {
  const { agent, permissions, events } = opts;
  const maxSteps = opts.maxSteps ?? 30;
  const maxReprompts = opts.maxReprompts ?? 3;

  const driver = makeDriver(agent.toolMode, toolSpecs());
  const ctx = { workspace: opts.workspace, permissions };

  const messages: Message[] =
    opts.history && opts.history.length > 0
      ? [...opts.history, { role: "user", content: opts.task }]
      : [
          { role: "system", content: driver.systemPrompt(opts.promptContext) },
          { role: "user", content: opts.task },
        ];

  let consecutiveNoTool = 0;
  let lastFailSig = "";
  let failStreak = 0;
  const maxToolRetries = opts.maxToolRetries ?? 3;
  const usage: Usage = { promptTokens: 0, completionTokens: 0 };

  for (let step = 1; step <= maxSteps; step++) {
    if (opts.signal?.aborted) return { finished: false, reason: "cancelled", steps: step - 1, messages, usage };
    events?.onStep?.(step);

    let response;
    try {
      response = await agent.provider.chat({
        messages,
        tools: driver.providerTools(),
        params: opts.params,
        signal: opts.signal,
      });
    } catch (err) {
      if (opts.signal?.aborted) return { finished: false, reason: "cancelled", steps: step, messages, usage };
      throw err;
    }
    usage.promptTokens += response.usage?.promptTokens ?? 0;
    usage.completionTokens += response.usage?.completionTokens ?? 0;
    events?.onUsage?.(usage);
    const { toolCalls, text } = driver.parse(response);
    messages.push(driver.assistantMessage(response, toolCalls));
    if (text) events?.onAssistantText?.(text);

    if (toolCalls.length === 0) {
      const stalled = text.trim().length === 0 || looksLikeStall(text);
      if (stalled) {
        // The "yes, you can act" reinforcement loop for models that refuse/stall.
        if (consecutiveNoTool < maxReprompts) {
          consecutiveNoTool++;
          events?.onReprompt?.(consecutiveNoTool);
          messages.push(driver.repromptMessage());
          continue;
        }
        return { finished: false, reason: "stalled", steps: step, messages, usage };
      }
      // A normal conversational reply — hand control back to the user, no nagging.
      return { finished: false, reason: "reply", steps: step, messages, usage };
    }
    consecutiveNoTool = 0;

    for (const call of toolCalls) {
      if (opts.signal?.aborted) return { finished: false, reason: "cancelled", steps: step, messages, usage };
      events?.onToolCall?.(call);

      if (call.name === "finish") {
        const summary = String(call.arguments.summary ?? "").trim();
        return { finished: true, reason: "finished", summary, steps: step, messages, usage };
      }

      const tool = getTool(call.name);
      const result: ToolResult = tool
        ? await tool.run(call.arguments, ctx)
        : { ok: false, output: `Unknown tool "${call.name}". Available: ${toolSpecs().map((t) => t.name).join(", ")}` };

      events?.onToolResult?.(call, result);
      messages.push(driver.toolResultMessage(call, result.output));

      // Break out of a loop where the same tool call keeps failing identically.
      if (result.ok) {
        failStreak = 0;
        lastFailSig = "";
      } else {
        const sig = `${call.name}:${JSON.stringify(call.arguments)}`;
        failStreak = sig === lastFailSig ? failStreak + 1 : 1;
        lastFailSig = sig;
        if (failStreak >= maxToolRetries) {
          return { finished: false, reason: "stalled", steps: step, messages, usage };
        }
      }
    }
  }

  return { finished: false, reason: "maxsteps", steps: maxSteps, messages, usage };
}
