import type { ToolSpec } from "../providers/types.js";
import type { PermissionEngine } from "../permissions/modes.js";

export interface ToolContext {
  workspace: string;
  permissions: PermissionEngine;
}

export interface ToolResult {
  ok: boolean;
  /** Text fed back to the model describing the outcome. */
  output: string;
}

export interface Tool {
  spec: ToolSpec;
  /** True if the tool changes the workspace or runs commands (gated by permission mode). */
  mutating: boolean;
  run(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

/** Sentinel tool the model calls to signal completion; intercepted by the loop. */
export const FINISH_TOOL: ToolSpec = {
  name: "finish",
  description: "Call when the task is fully complete. Provide a short summary of what was done.",
  parameters: {
    type: "object",
    properties: {
      summary: { type: "string", description: "Summary of the work completed" },
    },
    required: ["summary"],
  },
};
