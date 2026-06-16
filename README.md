# Polypus 🐙

An agentic coding harness that makes **any** AI API generate and apply code —
even models **without** native tool-calling. Bring your own keys: OpenRouter,
Ollama, Anthropic, or any OpenAI-compatible endpoint. Run one agent, or split a
task across **several agents working in parallel** in isolated git worktrees.

- 🔌 **Any provider.** OpenRouter and Ollama out of the box (both OpenAI-compatible), plus a generic endpoint and native Anthropic.
- 🧩 **Tool-calling for everyone.** Models with function-calling use it natively; models without it get an XML tool protocol injected into the prompt and parsed back — so base/local models can code too.
- 🔐 **Permission modes.** `plan` (read-only), `review` (confirm each action), `bypass` (auto-approve), with a path allow-list.
- 🐝 **Parallel swarm.** A lead agent decomposes a task into subtasks; workers run concurrently in git worktrees and merge at the end.
- 🪄 **Setup wizard.** Interactive onboarding for keys, models, and permissions.
- 🕵️ **No telemetry.** Nothing leaves your machine except calls to the providers you configure.

> Status: early MVP. Expect rough edges.

## Install

```bash
git clone <this-repo> polypus && cd polypus
npm install
npm run build
npm link        # optional: makes `polypus` available globally
```

Requires Node.js 20+.

## Quickstart

### Option A — guided

```bash
polypus setup
```

The wizard walks you through adding one or more agents, choosing how API keys are
stored (env var recommended), and setting the default permission mode.

### Option B — manual

**OpenRouter** (hosted):

```bash
export OPENROUTER_API_KEY=sk-or-...
polypus add-agent or \
  --provider openrouter \
  --model "anthropic/claude-3.5-sonnet" \
  --api-key '${OPENROUTER_API_KEY}'
```

**Ollama** (local, no key, emulated tools by default):

```bash
# ollama serve && ollama pull llama3.1
polypus add-agent local --provider ollama --model llama3.1
```

Then run a task in the current directory:

```bash
polypus run "create a Fastify server in src/server.ts with a /health route"
```

Or start an interactive session:

```bash
polypus run
```

## Commands

| Command | Description |
| --- | --- |
| `polypus setup` | Interactive wizard (agents, keys, permissions). |
| `polypus add-agent <name> --provider <p> --model <m> [--api-key ...] [--base-url ...] [--tool-mode auto\|native\|emulated] [--set-default]` | Register an agent. |
| `polypus remove-agent <name>` | Remove an agent. |
| `polypus list-agents` | List configured agents. |
| `polypus run [task] [--agent <name>] [--mode plan\|review\|bypass] [--max-steps <n>]` | Run a task, or open a REPL if no task is given. |
| `polypus swarm <task> [--agents a,b] [--max-subtasks <n>]` | Split a task across agents in parallel worktrees. |

### Interactive slash commands (in `polypus run`)

```
/plan            read-only mode
/review          confirm each write / command
/bypass          auto-approve
/allow <glob>    add a path to the allow-list
/reset           clear the conversation
/help            list commands
/exit            quit
```

## How non-tool models "code"

Models with native function-calling (most hosted models) use it directly. For
models **without** it, Polypus injects a strict XML protocol into the system
prompt and parses the model's text output:

```xml
<polypus:tool name="write_file">
<arg name="path">src/index.ts</arg>
<arg name="content">console.log("hello");</arg>
</polypus:tool>
```

The parser tolerates angle brackets inside code. When the model stalls or claims
it "can't create files", Polypus re-sends a reinforcement message ("yes, you ARE
allowed to act now") up to a few times before giving up. When the work is done,
the model calls the `finish` tool.

Set the path per agent with `--tool-mode`: `auto` (native for hosted, emulated
for Ollama), `native`, or `emulated`.

## Permissions

| Mode | File writes | Commands |
| --- | --- | --- |
| `plan` | blocked | blocked |
| `review` | confirm each | confirm (unless pre-approved) |
| `bypass` | auto | auto |

All file access is restricted to the workspace and the configured **allow-list**
globs; the **deny-list** (e.g. `.git/**`, `**/.env`) always wins.

## Swarm (parallel agents)

```bash
polypus swarm "add a REST API and a matching test suite"
```

The lead agent splits the task into subtasks, each worker runs in its own git
worktree (in `bypass` mode, since the worktree is throwaway), and the branches
are merged back sequentially. Conflicting branches are kept for manual
inspection rather than force-merged.

## Configuration

Stored at `~/.polypus/config.json` (override the directory with `POLYPUS_HOME`).
API keys may be inline or, preferably, an env reference:

```json
{
  "version": 1,
  "defaultAgent": "or",
  "agents": [
    {
      "name": "or",
      "provider": "openrouter",
      "baseUrl": "https://openrouter.ai/api/v1",
      "model": "anthropic/claude-3.5-sonnet",
      "apiKey": "${OPENROUTER_API_KEY}",
      "toolMode": "auto"
    }
  ],
  "permissions": {
    "mode": "review",
    "allow": ["**/*"],
    "deny": [".git/**", ".polypus/**", "**/.env"],
    "allowedCommands": []
  }
}
```

## Development

```bash
npm run dev        # build in watch mode
npm run typecheck
npm test           # vitest
```

## License

MIT
