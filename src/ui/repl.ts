import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import pc from "picocolors";
import type { PermissionMode } from "../core/config/schema.js";
import type { SessionState } from "../cli/commands/run.js";

type TaskRunner = (task: string) => Promise<void>;

const HELP = `
${pc.bold("Slash commands:")}
  /plan            switch to plan mode (read-only)
  /review          switch to review mode (confirm each action)
  /bypass          switch to bypass mode (auto-approve)
  /allow <glob>    add a path glob to the allow-list
  /allow           show the current allow-list and mode
  /reset           clear the conversation history
  /help            show this help
  /exit            quit
Anything else is sent to the agent as a task.
`.trim();

/** Interactive session loop. Type tasks or slash commands. */
export async function startRepl(runTask: TaskRunner, session: SessionState): Promise<void> {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  console.log(pc.bold("\nPolypus interactive session.") + pc.dim(" Type /help for commands, /exit to quit.\n"));

  try {
    for (;;) {
      const line = (await rl.question(pc.green(`polypus(${session.mode})› `))).trim();
      if (!line) continue;

      if (line.startsWith("/")) {
        const done = handleCommandLine(line, session);
        if (done) break;
        continue;
      }
      await runTask(line);
    }
  } finally {
    rl.close();
  }
}

/** Returns true when the session should exit. */
function handleCommandLine(line: string, session: SessionState): boolean {
  const [cmd, ...rest] = line.slice(1).split(/\s+/);
  const arg = rest.join(" ").trim();

  switch (cmd) {
    case "exit":
    case "quit":
      return true;
    case "help":
      console.log(HELP);
      return false;
    case "plan":
    case "review":
    case "bypass":
      session.mode = cmd as PermissionMode;
      console.log(pc.dim(`mode → ${cmd}`));
      return false;
    case "allow":
      if (arg) {
        session.allow = [...session.allow, arg];
        console.log(pc.dim(`allow-list += ${arg}`));
      } else {
        console.log(pc.dim(`mode=${session.mode} allow=[${session.allow.join(", ")}]`));
      }
      return false;
    case "reset":
      session.history = [];
      console.log(pc.dim("history cleared"));
      return false;
    default:
      console.log(pc.yellow(`Unknown command /${cmd}. Type /help.`));
      return false;
  }
}
