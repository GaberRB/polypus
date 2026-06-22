import type { Message, Provider } from "../providers/types.js";

export interface PrMeta {
  number?: number;
  title: string;
  body: string;
}

/**
 * Diffs above this many chars are truncated so they fit a free model's context.
 * Override with POLYPUS_MAX_DIFF_CHARS for models with a smaller window.
 */
export const MAX_DIFF_CHARS = Number(process.env.POLYPUS_MAX_DIFF_CHARS) || 60_000;

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
export async function reviewDiff(
  diff: string,
  meta: PrMeta,
  provider: Provider,
  projectGuide?: string,
): Promise<string> {
  if (!diff.trim()) return "_Sem alterações no diff para revisar._";
  const messages: Message[] = [{ role: "system", content: SYSTEM }];
  if (projectGuide) {
    messages.push({
      role: "system",
      content: `Project context and conventions to review against:\n${projectGuide}`,
    });
  }
  messages.push({ role: "user", content: buildReviewPrompt(diff, meta) });
  const res = await provider.chat({
    messages,
    params: { maxTokens: 1500, temperature: 0.2 },
  });
  const text = res.content.trim();
  if (!text) throw new Error("The model returned an empty review.");
  return text;
}

/** A single review finding, optionally tied to a file. */
export interface ReviewFinding {
  file?: string;
  issue: string;
}

/** Findings grouped by severity. `blocking` are bugs that must be fixed first. */
export interface StructuredReview {
  blocking: ReviewFinding[];
  warnings: ReviewFinding[];
  suggestions: ReviewFinding[];
}

const SYSTEM_JSON = [
  "You are a senior code reviewer. Review the pull request diff and return ONLY a",
  "JSON object — no prose, no Markdown fences — with this exact shape:",
  '{"blocking":[{"file":"path","issue":"..."}],"warnings":[],"suggestions":[]}',
  "Rules:",
  "- `blocking`: correctness or security bugs that MUST be fixed before merge.",
  "  Only include a finding when you are confident it is a real bug given the diff.",
  "  Do NOT invent issues or guess about code you cannot see — when unsure, leave it out.",
  "- `warnings`: likely problems worth a second look (not certainly bugs).",
  "- `suggestions`: optional quality/maintainability improvements.",
  "- If there are no blocking bugs, return an empty `blocking` array.",
  "- Write each `issue` in the same language as the PR description (Portuguese if it is).",
].join("\n");

/** Coerce arbitrary model output into a list of findings (tolerant of shapes). */
function normFindings(value: unknown): ReviewFinding[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v): ReviewFinding | null => {
      if (typeof v === "string") return v.trim() ? { issue: v.trim() } : null;
      if (v && typeof v === "object") {
        const o = v as { file?: unknown; issue?: unknown; message?: unknown };
        const issue = typeof o.issue === "string" ? o.issue : typeof o.message === "string" ? o.message : "";
        if (!issue.trim()) return null;
        return typeof o.file === "string" && o.file.trim()
          ? { file: o.file.trim(), issue: issue.trim() }
          : { issue: issue.trim() };
      }
      return null;
    })
    .filter((f): f is ReviewFinding => f !== null);
}

/**
 * Parse a structured-review response into typed findings. Tolerant of code
 * fences and surrounding prose; returns empty groups if no JSON can be found.
 */
export function parseStructuredReview(text: string): StructuredReview {
  const empty: StructuredReview = { blocking: [], warnings: [], suggestions: [] };
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return empty;
  try {
    const o = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    return {
      blocking: normFindings(o.blocking),
      warnings: normFindings(o.warnings),
      suggestions: normFindings(o.suggestions),
    };
  } catch {
    return empty;
  }
}

/**
 * Review a diff and return findings grouped by severity (machine-readable).
 * Used to gate the autonomous agent's self-correction loop.
 */
export async function reviewDiffStructured(
  diff: string,
  meta: PrMeta,
  provider: Provider,
  projectGuide?: string,
): Promise<StructuredReview> {
  if (!diff.trim()) return { blocking: [], warnings: [], suggestions: [] };
  const messages: Message[] = [{ role: "system", content: SYSTEM_JSON }];
  if (projectGuide) {
    messages.push({
      role: "system",
      content: `Project context and conventions to review against:\n${projectGuide}`,
    });
  }
  messages.push({ role: "user", content: buildReviewPrompt(diff, meta) });
  const res = await provider.chat({
    messages,
    params: { maxTokens: 1500, temperature: 0.2 },
  });
  return parseStructuredReview(res.content);
}
