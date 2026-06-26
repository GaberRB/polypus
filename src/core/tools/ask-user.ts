import { z } from "zod";
import type { Tool } from "./types.js";

/** Accept options as plain strings or {label} objects, normalizing to strings. */
const Option = z.union([
  z.string().min(1),
  z.object({ label: z.string().min(1) }).transform((o) => o.label),
]);

const Args = z.object({
  question: z.string().min(1),
  options: z.array(Option).min(2),
  multi: z.boolean().optional(),
});

/**
 * Let the agent ask the user a choice question instead of guessing. In an
 * interactive session it renders an arrow-key picker (single- or multi-select);
 * in headless mode (no TTY) there is no one to answer, so it returns a clear
 * signal telling the agent to proceed with its best judgment.
 */
export const askUserTool: Tool = {
  mutating: false,
  spec: {
    name: "ask_user",
    description:
      "Ask the user to choose between options when a decision is genuinely theirs " +
      "(not something you can infer). Renders an interactive picker. Set multi=true " +
      "to allow selecting more than one option.",
    parameters: {
      type: "object",
      properties: {
        question: { type: "string", description: "The question to ask" },
        options: {
          type: "array",
          description: "2+ choices (strings)",
          items: { type: "string" },
        },
        multi: { type: "boolean", description: "Allow selecting more than one option" },
      },
      required: ["question", "options"],
    },
  },
  async run(rawArgs, ctx) {
    const parsed = Args.safeParse(rawArgs);
    if (!parsed.success) {
      return { ok: false, output: "Invalid args: need 'question' and at least 2 'options'." };
    }
    if (!ctx.ask) {
      // Headless / no TTY: nobody to answer.
      return {
        ok: false,
        output:
          "No interactive UI available to ask the user (headless mode). " +
          "Proceed with the most reasonable default and state the assumption you made.",
      };
    }
    const { question, options, multi } = parsed.data;
    const answer = await ctx.ask({ question, options, multi });
    if (answer === null) {
      return { ok: false, output: "The user dismissed the question without choosing. Proceed with a sensible default." };
    }
    return { ok: true, output: `User selected: ${answer.join(", ")}` };
  },
};
