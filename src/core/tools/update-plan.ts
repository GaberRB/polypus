import { z } from "zod";
import type { Tool } from "./types.js";

/**
 * A lightweight, stateless planning tool. Weak/local models drift and "forget"
 * what they set out to do; maintaining an explicit checklist in the conversation
 * gives them a cheap memory of intent. The tool does not touch the workspace —
 * it just validates and renders the plan back so it stays in context (and the
 * host UI can show it via the tool result).
 */

const Status = z.enum(["pending", "in_progress", "done"]);

/** Accept either a rich {step,status} object or a bare string, per item. */
const Step = z.union([
  z.object({ step: z.string().min(1), status: Status.default("pending") }),
  z.string().min(1).transform((step) => ({ step, status: "pending" as const })),
]);

const Args = z.object({
  steps: z.array(Step).min(1),
});

const MARK: Record<z.infer<typeof Status>, string> = {
  pending: "[ ]",
  in_progress: "[~]",
  done: "[x]",
};

export const updatePlanTool: Tool = {
  mutating: false,
  spec: {
    name: "update_plan",
    description:
      "Record or update your short plan as a checklist. Call this FIRST with the " +
      "numbered steps you intend to take, then call it again to mark steps " +
      "in_progress/done as you go. Does not change any files.",
    parameters: {
      type: "object",
      properties: {
        steps: {
          type: "array",
          description:
            "The plan steps. Each item is either a string, or an object " +
            '{ "step": "...", "status": "pending|in_progress|done" }.',
          items: {
            type: "object",
            properties: {
              step: { type: "string", description: "What this step does" },
              status: {
                type: "string",
                description: "pending | in_progress | done",
              },
            },
            required: ["step"],
          },
        },
      },
      required: ["steps"],
    },
  },
  async run(rawArgs) {
    const parsed = Args.safeParse(rawArgs);
    if (!parsed.success) {
      return { ok: false, output: "Invalid args: 'steps' must be a non-empty array of steps." };
    }
    const lines = parsed.data.steps.map((s, i) => `${i + 1}. ${MARK[s.status]} ${s.step}`);
    return { ok: true, output: ["Plan updated:", ...lines].join("\n") };
  },
};
