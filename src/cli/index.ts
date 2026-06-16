import { Command } from "commander";
import pc from "picocolors";
import { addAgent } from "./commands/add-agent.js";
import { removeAgent } from "./commands/remove-agent.js";
import { listAgents } from "./commands/list-agents.js";
import { run } from "./commands/run.js";
import { setup } from "./commands/setup.js";
import { swarm } from "./commands/swarm.js";

const program = new Command();

program
  .name("polypus")
  .description(
    "Agentic coding harness that makes any AI API generate and apply code — " +
      "OpenRouter, Ollama, and any OpenAI-compatible endpoint.",
  )
  .version("0.1.0");

program
  .command("setup")
  .description("Interactive setup wizard (configure agents, keys, permissions)")
  .action(() => setup());

program
  .command("add-agent")
  .argument("<name>", "unique name for the agent")
  .requiredOption("--provider <provider>", "openrouter | ollama | openai-compatible | anthropic")
  .requiredOption("--model <model>", "model id, e.g. anthropic/claude-3.5-sonnet or llama3.1")
  .option("--api-key <key>", 'API key or env reference like "${OPENROUTER_API_KEY}"')
  .option("--base-url <url>", "override the provider base URL")
  .option("--tool-mode <mode>", "auto | native | emulated", "auto")
  .option("--set-default", "make this the default agent")
  .description("Register a new agent (API key + model)")
  .action((name, opts) => addAgent(name, opts));

program
  .command("remove-agent")
  .argument("<name>", "name of the agent to remove")
  .description("Remove a configured agent")
  .action((name) => removeAgent(name));

program
  .command("list-agents")
  .alias("agents")
  .description("List configured agents")
  .action(() => listAgents());

program
  .command("run")
  .argument("[task]", "task for the agent; omit to start an interactive session")
  .option("--agent <name>", "which configured agent to use")
  .option("--mode <mode>", "plan | review | bypass (overrides config)")
  .option("--max-steps <n>", "maximum agent steps")
  .description("Run a coding task with an agent")
  .action((task, opts) => run(task, opts));

program
  .command("swarm")
  .argument("<task>", "high-level task to split across agents")
  .option("--agents <names>", "comma-separated agent names (default: all configured)")
  .option("--max-subtasks <n>", "maximum number of parallel subtasks")
  .description("Split a task across multiple agents working in parallel git worktrees")
  .action((task, opts) => swarm(task, opts));

async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    console.error(pc.red(`✗ ${(err as Error).message}`));
    process.exitCode = 1;
  }
}

void main();
