import type { ResolvedAgent } from "../providers/registry.js";
import { estimateCost, fmtUsd, type ModelPricing } from "./usage.js";

export type Complexity = "low" | "medium" | "high";

export interface TaskEstimate {
  complexity: Complexity;
  /** Estimated number of agent steps (tool round-trips) to finish. */
  estimatedSteps: number;
  /** Estimated total tokens across the whole run (prompt + completion, summed). */
  estimatedTokens: number;
  rationale: string;
  risks: string;
  /** Estimated USD cost, when model pricing is known. */
  costUsd?: number;
  /** Human-readable cost (or "unknown" when pricing is unavailable). */
  costLabel: string;
}

const SYSTEM = [
  "You estimate the effort for an autonomous coding agent (a ReAct loop that reads/edits files",
  "and runs commands over several steps) to implement a software task in an existing repo.",
  "Account for the loop re-sending growing context each step. Be realistic, not optimistic.",
  "Return ONLY a JSON object, no prose, with exactly these keys:",
  '{"complexity":"low|medium|high","estimatedSteps":<int>,"estimatedTokens":<int total across all steps>,',
  '"rationale":"<one sentence>","risks":"<one sentence>"}',
].join(" ");

/** Extract the first balanced JSON object from a string (tolerant of surrounding prose). */
function extractJsonObject(text: string): Record<string, unknown> | undefined {
  const start = text.indexOf("{");
  if (start === -1) return undefined;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) {
      try {
        return JSON.parse(text.slice(start, i + 1)) as Record<string, unknown>;
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Ask the agent to estimate the effort/cost of a task (one model call, no tools).
 * The model estimates steps and total tokens; cost is computed deterministically
 * from the model's pricing (assuming an agent loop is ~80% prompt / 20% completion).
 */
export async function estimateTask(
  task: string,
  agent: ResolvedAgent,
  pricing?: ModelPricing,
): Promise<TaskEstimate> {
  const res = await agent.provider.chat({
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Task:\n${task}` },
    ],
    params: { temperature: 0 },
  });
  const parsed = extractJsonObject(res.content) ?? {};

  const complexity: Complexity = ["low", "medium", "high"].includes(parsed.complexity as string)
    ? (parsed.complexity as Complexity)
    : "medium";
  const estimatedSteps = clampInt(parsed.estimatedSteps, 1, 300, 30);
  const estimatedTokens = clampInt(parsed.estimatedTokens, 1_000, 20_000_000, 80_000);
  const rationale = typeof parsed.rationale === "string" ? parsed.rationale : "";
  const risks = typeof parsed.risks === "string" ? parsed.risks : "";

  let costUsd: number | undefined;
  let costLabel = "unknown (no pricing for this model)";
  if (pricing) {
    costUsd = estimateCost(
      { promptTokens: Math.round(estimatedTokens * 0.8), completionTokens: Math.round(estimatedTokens * 0.2) },
      pricing,
    );
    costLabel = fmtUsd(costUsd);
  }

  return { complexity, estimatedSteps, estimatedTokens, rationale, risks, costUsd, costLabel };
}
