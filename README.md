# Polypus 🐙

[![CI](https://github.com/GaberRB/polypus/actions/workflows/ci.yml/badge.svg)](https://github.com/GaberRB/polypus/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@gaberrb/polypus?color=9266F5&logo=npm)](https://www.npmjs.com/package/@gaberrb/polypus)
[![license](https://img.shields.io/badge/license-MIT-AB8EFA)](LICENSE)

**📖 Site:** https://gaberrb.github.io/polypus/ · **📦 npm:** [`@gaberrb/polypus`](https://www.npmjs.com/package/@gaberrb/polypus) · **📝 Changelog:** [CHANGELOG.md](https://github.com/GaberRB/polypus/blob/main/CHANGELOG.md)

An agentic coding harness that makes **any** AI API generate and apply code —
even models **without** native tool-calling. Bring your own keys: OpenRouter,
Ollama, Anthropic, or any OpenAI-compatible endpoint. Run one agent, or split a
task across **several agents working in parallel** in isolated git worktrees.

- 🔌 **Any provider.** OpenRouter and Ollama out of the box (both OpenAI-compatible), plus a generic endpoint and native Anthropic.
- 🧩 **Tool-calling for everyone.** Models with function-calling use it natively; models without it get an XML tool protocol injected into the prompt and parsed back — so base/local models can code too.
- 🔐 **Permission modes.** `plan` (read-only), `review` (confirm each action), `bypass` (auto-approve), with a path allow-list.
- 🐝 **Parallel swarm.** A lead agent decomposes a task into subtasks; workers run concurrently in git worktrees and merge at the end.
- 🪄 **Setup wizard.** Interactive onboarding for keys, models, and permissions.
- 🌎 **Bilingual UI.** Portuguese (pt-BR, default) and English.
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

Or just launch the interactive experience (banner + REPL):

```bash
polypus            # bare command → interactive; first run opens the setup wizard
polypus run        # same interactive session
```

> When you pick **Ollama** in the wizard, Polypus detects your running instance
> and lists the models you already have installed — no need to remember exact
> tags like `llama3.1:8b`. For **OpenRouter**, it pulls the live catalog so you
> can filter by price, context and tool support and pick a model from a list.

## Discovering models

Browse the OpenRouter catalog from the terminal — price (USD per 1M tokens, in/out),
context window, and whether the model supports native tool-calling:

```bash
polypus models --tools --max-price 1 --sort price   # cheap models that support tools
polypus models --search claude --sort price-desc     # all Claude models, priciest first
polypus models --free                                # free models only
```

The setup wizard uses the same data: choosing OpenRouter opens an interactive
browser with search, filters (tools-only, free-only) and sorting, then a picker
showing each model's price, tool badge and context.

## Commands

| Command | Description |
| --- | --- |
| `polypus setup` | Interactive wizard (agents, keys, permissions). |
| `polypus add-agent <name> --provider <p> --model <m> [--api-key ...] [--base-url ...] [--tool-mode auto\|native\|emulated] [--set-default]` | Register an agent. |
| `polypus remove-agent <name>` | Remove an agent. |
| `polypus list-agents` | List configured agents. |
| `polypus run [task] [--agent <name>] [--mode plan\|review\|bypass] [--max-steps <n>]` | Run a task, or open a REPL if no task is given. |
| `polypus swarm <task> [--agents a,b] [--max-subtasks <n>]` | Split a task across agents in parallel worktrees. |
| `polypus models [--search x] [--tools] [--free] [--max-price <usd>] [--sort price\|price-desc\|context\|name] [--limit <n>]` | Browse the OpenRouter catalog (price, context, tool support). |

### Interactive slash commands (in `polypus run`)

```
/agents          list configured agents
/agent <name>    switch the active agent
/add             add a new agent (wizard)
/remove <name>   remove an agent
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

## Language / Idioma

The interface is bilingual: **pt-BR (default)** and **en**. Resolution order:
`--lang` flag → `POLYPUS_LANG` env → `locale` in the config → pt-BR.

```bash
polypus --lang en run "create a CLI entrypoint"
POLYPUS_LANG=en polypus list-agents
```

The setup wizard asks for the language first and saves it to the config. The
agent is also instructed to talk back to you in the configured language.

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
API keys may be inline or, preferably, an env reference.

Polypus also loads a `.env` file from `~/.polypus/.env` (and the current
directory) at startup, so you can keep secrets there without relying on the OS
to propagate environment variables to your shell:

```dotenv
# ~/.polypus/.env
OPENROUTER_API_KEY=sk-or-...
```

Real environment variables always win over `.env` values. Example config:

```json
{
  "version": 1,
  "locale": "pt-BR",
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

## Contributing

Contributions are welcome — but **open an issue first**. Issues are triaged and labeled
`accepted` before any PR; PRs without a linked accepted issue don't pass CI. See
[CONTRIBUTING.md](CONTRIBUTING.md) for the full flow (issue → `accepted` → branch → PR → review).

## Apoie o projeto

Se o Polypus te ajudou, você pode apoiar o desenvolvimento via **PIX** 💜

> **Chave PIX (e-mail):** `gabrielriosbelmiro@gmail.com`

Qualquer valor é muito bem-vindo e ajuda a manter o projeto vivo. Obrigado!

## Author

**Gabriel Rios**

[![GitHub](https://img.shields.io/badge/GitHub-GaberRB-181717?logo=github)](https://github.com/GaberRB)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-gabriel--riosb-0A66C2?logo=linkedin)](https://www.linkedin.com/in/gabriel-riosb/)

Contributions, issues and feedback are welcome — open an issue or a PR.

## License

[MIT](LICENSE) © Gabriel Rios
