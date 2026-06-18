import type { Message, Provider } from "../providers/types.js";

export interface IssueInput {
  number?: number;
  title: string;
  body: string;
  /** Issue comments, oldest first. */
  comments?: { author?: string; body: string }[];
}

const SYSTEM = [
  "You are a product analyst. You turn a GitHub issue into a concise, structured PRD",
  "(Product Requirements Document) in Markdown.",
  "Rules:",
  "- Use ONLY information present in the issue and its comments. Do NOT invent scope,",
  "  numbers, deadlines, or stakeholders. If something is unknown, write 'A definir'.",
  "- Be objective and short; prefer bullet points over prose.",
  "- Write in the same language as the issue (Portuguese if the issue is in Portuguese).",
].join("\n");

/** Build the PRD prompt body from an issue. Exported for testing/inspection. */
export function buildPrdPrompt(issue: IssueInput): string {
  const comments = (issue.comments ?? [])
    .map((c, i) => `Comentário ${i + 1}${c.author ? ` (@${c.author})` : ""}:\n${c.body}`)
    .join("\n\n");
  return [
    `Issue${issue.number ? ` #${issue.number}` : ""}: ${issue.title}`,
    "",
    "Corpo:",
    issue.body || "(vazio)",
    comments ? `\n${comments}` : "",
    "",
    "Gere um PRD com EXATAMENTE estas seções (H2 com ##):",
    "## Contexto / Problema",
    "## Objetivo",
    "## Escopo (in / out)",
    "## Requisitos funcionais",
    "## Critérios de aceite",
    "## Riscos e alternativas",
  ].join("\n");
}

/**
 * Generate a PRD from an issue with a single (no-tool) chat call. Robust on the
 * small free OpenRouter models since input is one issue and output is a document.
 */
export async function generatePrd(
  issue: IssueInput,
  provider: Provider,
  projectContext?: string,
): Promise<string> {
  const messages: Message[] = [{ role: "system", content: SYSTEM }];
  if (projectContext) {
    messages.push({
      role: "system",
      content: `Project context (for grounding; do not restate verbatim):\n${projectContext}`,
    });
  }
  messages.push({ role: "user", content: buildPrdPrompt(issue) });
  const res = await provider.chat({
    messages,
    params: { maxTokens: 2000, temperature: 0.2 },
  });
  const text = res.content.trim();
  if (!text) throw new Error("The model returned an empty PRD.");
  return text;
}
