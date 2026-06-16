import { makeDriver } from "../protocol/emulated.js";
import type { PromptContext } from "../protocol/system-prompt.js";
import type { PermissionEngine } from "../permissions/modes.js";
import type { ResolvedAgent } from "../providers/registry.js";
import type { ChatParams, Message, ToolCall } from "../providers/types.js";
import { getTool, toolSpecs } from "../tools/registry.js";
import type { ToolResult } from "../tools/types.js";

export interface AgentEvents {
  onAssistantText?(text: string): void;
  onToolCall?(call: ToolCall): void;
  onToolResult?(call: ToolCall, result: ToolResult): void;
  onReprompt?(attempt: number): void;
  onStep?(step: number): void;
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
  events?: AgentEvents;
  /** Seed history (used to continue an interactive session). */
  history?: Message[];
}

export interface RunResult {
  finished: boolean;
  summary?: string;
  steps: number;
  messages: Message[];
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

  for (let step = 1; step <= maxSteps; step++) {
    events?.onStep?.(step);

    const response = await agent.provider.chat({
      messages,
      tools: driver.providerTools(),
      params: opts.params,
    });
    const { toolCalls, text } = driver.parse(response);
    messages.push(driver.assistantMessage(response, toolCalls));
    if (text) events?.onAssistantText?.(text);

    if (toolCalls.length === 0) {
      // The "yes, you can act" reinforcement loop for models that stall.
      if (consecutiveNoTool < maxReprompts) {
        consecutiveNoTool++;
        events?.onReprompt?.(consecutiveNoTool);
        messages.push(driver.repromptMessage());
        continue;
      }
      return { finished: false, steps: step, messages };
    }
    consecutiveNoTool = 0;

    for (const call of toolCalls) {
      events?.onToolCall?.(call);

      if (call.name === "finish") {
        const summary = String(call.arguments.summary ?? "").trim();
        return { finished: true, summary, steps: step, messages };
      }

      const tool = getTool(call.name);
      const result: ToolResult = tool
        ? await tool.run(call.arguments, ctx)
        : { ok: false, output: `Unknown tool "${call.name}". Available: ${toolSpecs().map((t) => t.name).join(", ")}` };

      events?.onToolResult?.(call, result);
      messages.push(driver.toolResultMessage(call, result.output));
    }
  }

  return { finished: false, steps: maxSteps, messages };
}
