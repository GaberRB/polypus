import type { Provider } from "../providers/types.js";

export interface PrMeta {
  number?: number;
  title: string;
  body: string;
}

/** Diffs above this many chars are truncated so they fit a free model's context. */
export const MAX_DIFF_CHARS = 60_000;

const SYSTEM = [
  "You are a senior code reviewer. Review the pull request diff below and report",
  "concrete findings in Markdown.",
  "Rules:",
  "- Focus on correctness bugs, security risks, and clear, actionable improvements.",
  "- Reference file paths (and line hints when visible) so findings are easy to locate.",
  "- Be concise. Skip style nitpicks unless they hide a real problem.",
  "- If there are no relevant problems, say so briefly instead of inventing issues.",
  "- Write in the same language as the PR description (Portuguese if it is in Portuguese).",
].join("\n");

/** Clip an oversized diff, keeping the head and noting how much was dropped. */
export function clampDiff(diff: string, max = MAX_DIFF_CHARS): string {
  if (diff.length <= max) return diff;
  const dropped = diff.length - max;
  return `${diff.slice(0, max)}\n\n… [diff truncado: ${dropped} caracteres omitidos para caber no contexto do modelo]`;
}

/** Build the review prompt body. Exported for testing/inspection. */
export function buildReviewPrompt(diff: string, meta: PrMeta): string {
  return [
    `PR${meta.number ? ` #${meta.number}` : ""}: ${meta.title}`,
    "",
    "Descrição:",
    meta.body || "(vazia)",
    "",
    "Diff:",
    "```diff",
    clampDiff(diff),
    "```",
    "",
    "Liste os achados agrupados por severidade (🔴 bug, 🟡 atenção, 🟢 sugestão).",
  ].join("\n");
}

/**
 * Review a PR diff with a single (no-tool) chat call. Returns Markdown suitable
 * for posting as a PR comment.
 */
export async function reviewDiff(diff: string, meta: PrMeta, provider: Provider): Promise<string> {
  if (!diff.trim()) return "_Sem alterações no diff para revisar._";
  const res = await provider.chat({
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: buildReviewPrompt(diff, meta) },
    ],
    params: { maxTokens: 1500, temperature: 0.2 },
  });
  const text = res.content.trim();
  if (!text) throw new Error("The model returned an empty review.");
  return text;
}
