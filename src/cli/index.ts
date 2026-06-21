import { Command } from "commander";
import pc from "picocolors";
import { addAgent } from "./commands/add-agent.js";
import { removeAgent } from "./commands/remove-agent.js";
import { listAgents } from "./commands/list-agents.js";
import { run } from "./commands/run.js";
import { setup } from "./commands/setup.js";
import { init } from "./commands/init.js";
import { swarm } from "./commands/swarm.js";
import { models } from "./commands/models.js";
import { usage } from "./commands/usage.js";
import { sessions } from "./commands/sessions.js";
import { prd } from "./commands/prd.js";
import { review } from "./commands/review.js";
import { join } from "node:path";
import { configDir, loadConfig } from "../core/config/store.js";
import { loadDotenv } from "../core/config/dotenv.js";
import { pickLocale, setLocale, t } from "../core/i18n/index.js";
import { banner } from "../ui/banner.js";
import { VERSION } from "../core/version.js";

/** Entry point for bare `polypus`: onboard on first run, then start interactive mode. */
async function launchInteractive(): Promise<void> {
  const config = await loadConfig();
  if (config.agents.length === 0) {
    console.log(banner());
    console.log("  " + pc.yellow(t("welcome.firstRun")) + "\n");
    await setup();
  }
  await run(undefined, {});
}

/** Read --lang from argv before commander parses, so help text is localized too. */
function flagLocale(argv: string[]): string | undefined {
  const i = argv.indexOf("--lang");
  if (i !== -1 && argv[i + 1]) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith("--lang="));
  return eq?.split("=")[1];
}

async function resolveLocale(): Promise<void> {
  let configLocale: string | undefined;
  try {
    configLocale = (await loadConfig()).locale;
  } catch {
    /* ignore invalid/missing config for locale purposes */
  }
  setLocale(pickLocale({ flag: flagLocale(process.argv), config: configLocale }));
}

function buildProgram(): Command {
  const program = new Command();

  program
    .name("polypus")
    .description(t("cli.description"))
    .version(VERSION)
    .option("--lang <locale>", t("cli.opt.lang"))
    // No subcommand → launch the interactive experience (Claude/Devin-style).
    .action(() => launchInteractive());

  program
    .command("setup")
    .description(t("cli.cmd.setup"))
    .action(() => setup());

  program
    .command("init")
    .option("--force", t("cli.opt.force"))
    .description(t("cli.cmd.init"))
    .action((opts) => init(opts));

  program
    .command("add-agent")
    .argument("<name>", t("cli.arg.addAgentName"))
    .requiredOption("--provider <provider>", t("cli.opt.provider"))
    .requiredOption("--model <model>", t("cli.opt.model"))
    .option("--api-key <key>", t("cli.opt.apiKey"))
    .option("--base-url <url>", t("cli.opt.baseUrl"))
    .option("--tool-mode <mode>", t("cli.opt.toolMode"), "auto")
    .option("--set-default", t("cli.opt.setDefault"))
    .description(t("cli.cmd.addAgent"))
    .action((name, opts) => addAgent(name, opts));

  program
    .command("remove-agent")
    .argument("<name>", t("cli.arg.removeAgentName"))
    .description(t("cli.cmd.removeAgent"))
    .action((name) => removeAgent(name));

  program
    .command("list-agents")
    .alias("agents")
    .description(t("cli.cmd.listAgents"))
    .action(() => listAgents());

  program
    .command("run")
    .argument("[task]", t("cli.arg.runTask"))
    .option("--agent <name>", t("cli.opt.agent"))
    .option("--mode <mode>", t("cli.opt.mode"))
    .option("--max-steps <n>", t("cli.opt.maxSteps"))
    .option("--json", t("cli.opt.json"))
    .option("--verify", t("cli.opt.verify"))
    .option("--budget <usd>", t("cli.opt.budget"))
    .option("--continue", t("cli.opt.continue"))
    .option("--resume <id>", t("cli.opt.resume"))
    .description(t("cli.cmd.run"))
    .action((task, opts) => run(task, opts));

  program
    .command("swarm")
    .argument("<task>", t("cli.arg.swarmTask"))
    .option("--agents <names>", t("cli.opt.agents"))
    .option("--max-subtasks <n>", t("cli.opt.maxSubtasks"))
    .description(t("cli.cmd.swarm"))
    .action((task, opts) => swarm(task, opts));

  program
    .command("models")
    .option("--search <text>", t("cli.opt.search"))
    .option("--tools", t("cli.opt.toolsOnly"))
    .option("--free", t("cli.opt.free"))
    .option("--max-price <usd>", t("cli.opt.maxPrice"))
    .option("--sort <order>", t("cli.opt.sort"))
    .option("--limit <n>", t("cli.opt.limit"))
    .description(t("cli.cmd.models"))
    .action((opts) => models(opts));

  program
    .command("usage")
    .description(t("cli.cmd.usage"))
    .action(() => usage());

  program
    .command("sessions")
    .description(t("cli.cmd.sessions"))
    .action(() => sessions());

  program
    .command("prd")
    .argument("<issue>", t("cli.arg.prdIssue"))
    .option("--out <file>", t("cli.opt.out"))
    .option("--model <model>", t("cli.opt.model"))
    .option("--input <file>", t("cli.opt.input"))
    .description(t("cli.cmd.prd"))
    .action((issue, opts) => prd(issue, opts));

  program
    .command("review")
    .argument("<pr>", t("cli.arg.reviewPr"))
    .option("--out <file>", t("cli.opt.out"))
    .option("--model <model>", t("cli.opt.model"))
    .option("--input <file>", t("cli.opt.input"))
    .description(t("cli.cmd.review"))
    .action((pr, opts) => review(pr, opts));

  return program;
}

async function main() {
  try {
    // Pick up secrets from ~/.polypus/.env and ./.env (does not override real env).
    loadDotenv([join(configDir(), ".env"), join(process.cwd(), ".env")]);
    await resolveLocale();
    await buildProgram().parseAsync(process.argv);
  } catch (err) {
    console.error(pc.red(`✗ ${(err as Error).message}`));
    process.exitCode = 1;
  }
}

void main();
