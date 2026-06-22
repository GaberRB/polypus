import type { Message, Provider } from "../providers/types.js";
import type { IssueInput } from "./prd.js";
import { resolveFreeProvider, DEFAULT_PRD_MODEL } from "./free-provider.js";
import { generatePrd } from "./prd.js";

export interface TaskExecution {
  name: string;
  model: string;
  usage: number;
  cost: number;
  done: boolean;
}

export interface TaskGeneratorResult {
  tasks: TaskExecution[];
  totalCost: number;
  totalTokens: number;
  model: string;
}

const SYSTEM = [
  "You are a task decomposer. Break a PRD into independent, parallelizable tasks.",
  "Rules:",
  "- Each task must be self-contained and not depend on other tasks.",
  "- Be concise and use bullet points.",
  "- Write in the same language as the PRD.",
  "- Include the estimated token usage and cost for each task (based on the model used).",
].join("\n");

export function buildTaskPrompt(prd: string): string {
  return [
    "## PRD:",
    prd,
    "\n",
    "## Tasks:",
    "Generate a list of tasks with the following format:",
    "- **Task 01: Description**\n  * **Model:** `model-name`\n  * **Usage:** X tokens\n  * **Cost:** $Y",
  ].join("\n");
}

export async function generateTasks(
  prd: string,
  provider: Provider,
  model = DEFAULT_PRD_MODEL,
): Promise<TaskGeneratorResult> {
  const messages: Message[] = [{ role: "system", content: SYSTEM }];
  messages.push({ role: "user", content: buildTaskPrompt(prd) });

  const res = await provider.chat({
    messages,
    params: { maxTokens: 2000, temperature: 0.2 },
  });

  const text = res.content.trim();
  if (!text) throw new Error("The model returned empty tasks.");

  // Parse the tasks from the response
  const taskLines = text.split("\n").filter((line) => line.trim().startsWith("-"));
  const tasks: TaskExecution[] = [];
  let totalCost = 0;
  let totalTokens = 0;

  for (const line of taskLines) {
    const match = line.match(
      /^- \[?(?<done>x)?\]?\s*\*\*(?<name>.+?)\*\*\s*\*\*Model:\*\* `(?<model>.+?)`\s*\*\*Usage:\*\* (?<usage>\d+) tokens\s*\*\*Cost:\*\* \$(?<cost>\d+\.\d+)/,
    );

    if (match?.groups?.name && match.groups.model && match.groups.usage && match.groups.cost) {
      const { name, model, usage, cost, done } = match.groups;
      tasks.push({
        name: name.trim(),
        model,
        usage: Number(usage),
        cost: Number(cost),
        done: done === "x",
      });
      totalCost += Number(cost);
      totalTokens += Number(usage);
    }
  }

  return {
    tasks,
    totalCost,
    totalTokens,
    model,
  };
}

export async function generateTasksFromIssue(
  issue: IssueInput,
  provider: Provider,
  model = DEFAULT_PRD_MODEL,
): Promise<TaskGeneratorResult> {
  const prd = await generatePrd(issue, provider, model);
  return generateTasks(prd, provider, model);
}

// Re-export for convenience
export { generatePrd } from "./prd.js";