import { makeDriver } from "../protocol/emulated.js";
import type { PromptContext } from "../protocol/system-prompt.js";
import type { PermissionEngine } from "../permissions/modes.js";
import type { ResolvedAgent } from "../providers/registry.js";
import type { ChatParams, Message, ToolCall } from "../providers/types.js";
import { getTool, toolSpecs } from "../tools/registry.js";
import type { Tool, ToolResult } from "../tools/types.js";
import { buildCorrection, makeLLMEscalator, truncationGuidance } from "./correction.js";
import { loadProjectInstructions } from "./project-context.js";
import { compactHistory, estimateTokens } from "./compaction.js";
import { runAfterHook, screenCommandHook, type HooksConfig } from "./hooks.js";

export interface Usage {
  promptTokens: number;
  completionTokens: number;
}

export interface AgentEvents {
  onAssistantText?(text: string): void;
  onToolCall?(call: ToolCall): void;
  onToolResult?(call: ToolCall, result: ToolResult): void;
  onReprompt?(attempt: number): void;
  /** Fired when auto-correction enriches a failed tool result with guidance. */
  onCorrection?(call: ToolCall, guidance: string): void;
  onStep?(step: number): void;
  /** Cumulative token usage so far this run. */
  onUsage?(usage: Usage): void;
  /** Fired when old history is summarized to free up context (token counts). */
  onCompaction?(before: number, after: number): void;
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
  /** Enrich failed tool results with corrective guidance so the model can self-heal (default true). */
  autoCorrect?: boolean;
  /** Summarize old history when the prompt grows past this many tokens (0 disables). */
  compactThresholdTokens?: number;
  /** User-declared custom tools (from `.poly/tools/*.json`) available to the agent. */
  extraTools?: Tool[];
  /** Pre/post-tool hooks (from `.poly/hooks.json`). */
  hooks?: HooksConfig;
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

  // Merge user-declared custom tools with the built-ins (finish stays last).
  const extra = opts.extraTools ?? [];
  const extraByName = new Map(extra.map((tl) => [tl.spec.name, tl]));
  const baseSpecs = toolSpecs();
  const finishSpec = baseSpecs[baseSpecs.length - 1]!;
  const allSpecs = [...baseSpecs.slice(0, -1), ...extra.map((tl) => tl.spec), finishSpec];
  const resolveTool = (name: string): Tool | undefined => extraByName.get(name) ?? getTool(name);

  const driver = makeDriver(agent.toolMode, allSpecs);
  const ctx = { workspace: opts.workspace, permissions };

  const seeding = !(opts.history && opts.history.length > 0);
  // On a fresh conversation, auto-load project operating instructions
  // (.poly/agents.md / AGENTS.md) into the system prompt unless the caller
  // already supplied them. Continued sessions keep the original system message.
  const promptContext =
    seeding && opts.promptContext.projectInstructions === undefined
      ? { ...opts.promptContext, projectInstructions: await loadProjectInstructions(opts.workspace) }
      : opts.promptContext;

  const messages: Message[] = seeding
    ? [
        { role: "system", content: driver.systemPrompt(promptContext) },
        { role: "user", content: opts.task },
      ]
    : [...opts.history!, { role: "user", content: opts.task }];

  let consecutiveNoTool = 0;
  let lastFailSig = "";
  let failStreak = 0;
  const maxToolRetries = opts.maxToolRetries ?? 3;
  const autoCorrect = opts.autoCorrect ?? true;
  const usage: Usage = { promptTokens: 0, completionTokens: 0 };
  const compactThreshold = opts.compactThresholdTokens ?? 0;
  let lastPromptTokens = 0;

  for (let step = 1; step <= maxSteps; step++) {
    if (opts.signal?.aborted) return { finished: false, reason: "cancelled", steps: step - 1, messages, usage };
    events?.onStep?.(step);

    // Auto-compact: when the prompt grows past the threshold, summarize old
    // history into one message, preserving the system prompt and recent turns.
    if (compactThreshold > 0) {
      const current = lastPromptTokens || estimateTokens(messages);
      if (current >= compactThreshold) {
        const compacted = await compactHistory(messages, agent, opts.signal);
        if (compacted.length < messages.length) {
          messages.splice(0, messages.length, ...compacted);
          lastPromptTokens = estimateTokens(messages);
          events?.onCompaction?.(current, lastPromptTokens);
        }
      }
    }

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
    lastPromptTokens = response.usage?.promptTokens ?? estimateTokens(messages);
    events?.onUsage?.(usage);
    const { toolCalls, text } = driver.parse(response);
    messages.push(driver.assistantMessage(response, toolCalls));
    if (text) events?.onAssistantText?.(text);

    // The model's output was cut off at the token limit — its tool call (if any)
    // is incomplete. Surfaced as guidance so it can recover by splitting output.
    const truncated = response.finishReason === "length" || response.finishReason === "max_tokens";

    if (toolCalls.length === 0) {
      // Cut off before producing any tool call (e.g. a half-written file dump).
      if (truncated && autoCorrect) {
        if (consecutiveNoTool < maxReprompts) {
          consecutiveNoTool++;
          const guidance = truncationGuidance();
          events?.onCorrection?.({ id: "trunc", name: "", arguments: {} }, guidance);
          messages.push({ role: "user", content: guidance });
          continue;
        }
        return { finished: false, reason: "stalled", steps: step, messages, usage };
      }
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

      const tool = resolveTool(call.name);
      // Pre-tool hook: the user's beforeCommand deny-list can block a command.
      const hookScreen =
        call.name === "run_command"
          ? screenCommandHook(opts.hooks, String(call.arguments.command ?? ""))
          : { blocked: false as const };

      let result: ToolResult;
      if (hookScreen.blocked) {
        result = { ok: false, output: `Command blocked by hook: ${hookScreen.reason}` };
      } else if (tool) {
        result = await tool.run(call.arguments, ctx);
        // Post-tool hook: e.g. format a file after a successful write/edit.
        if (result.ok) {
          const note = await runAfterHook(opts.hooks, call, opts.workspace);
          if (note) result = { ...result, output: `${result.output}\n${note}` };
        }
      } else {
        result = { ok: false, output: `Unknown tool "${call.name}". Available: ${allSpecs.map((t) => t.name).join(", ")}` };
      }

      events?.onToolResult?.(call, result);

      const sig = `${call.name}:${JSON.stringify(call.arguments)}`;
      let resultText = result.output;
      // Auto-correction: on failure, enrich the raw error with its likely cause
      // and the missing context so the model can fix its own call instead of
      // looping on it until the stall guard trips.
      if (!result.ok && autoCorrect) {
        const guidance = await buildCorrection(call, result.output, {
          workspace: opts.workspace,
          allow: opts.promptContext.allow,
          toolSpec: tool?.spec,
          truncated,
          // Only spend a fixer-LLM call once the model has already repeated a
          // failing call — the first failure gets deterministic help for free.
          escalate: sig === lastFailSig ? makeLLMEscalator(agent.provider) : undefined,
        });
        if (guidance) {
          resultText = `${result.output}\n\n${guidance}`;
          events?.onCorrection?.(call, guidance);
        }
      } else if (result.ok && truncated && autoCorrect) {
        // The call "succeeded" but the response was cut off, so the written file
        // is likely incomplete — flag it so the model can finish/repair it.
        const guidance = truncationGuidance(call.name);
        resultText = `${result.output}\n\n${guidance}`;
        events?.onCorrection?.(call, guidance);
      }
      messages.push(driver.toolResultMessage(call, resultText));

      // Break out of a loop where the same tool call keeps failing identically.
      if (result.ok) {
        failStreak = 0;
        lastFailSig = "";
      } else {
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
