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

## Project memory (`.poly/`)

`.poly/` is a small, local workspace that teaches the agent how to work in your
repository. Scaffold it with:

```bash
polypus init        # creates .poly/ if missing; --force overwrites
```

It writes a didactic starter set:

- `agents.md` — role, golden rules and an index of skills. **Polypus loads this
  file automatically** into the agent's system prompt on every run, so the agent
  follows your conventions instead of guessing.
- `skills/` — focused how-to guides the agent reads when relevant.
- `templates/spec.md` — a lean Spec-Driven Development (SDD) template.
- `README.md` — explains the workspace and how to extend it.

Edit `agents.md` to encode your conventions and reference new skills from it.
Gitignore `.poly/` to keep it personal, or commit it to standardize the workflow
across your team.

### Skills (project + global)

Skills are focused how-to guides the agent pulls in **on demand**. Drop markdown
files in either place — project skills win over global ones of the same name:

- **Project:** `.poly/skills/*.md`
- **Global (all projects):** `~/.polypus/skills/*.md`

Each file may start with frontmatter so only its summary is advertised to the
model (cheap); the full body is loaded only when the agent decides it's relevant:

```markdown
---
name: deploy
description: how to cut and publish a release
---
# Deploy
1. …
```

Polypus injects the skills **index** (name + description) into the system prompt
and exposes a `use_skill` tool. When the agent activates one, you'll see a line
like `🎯 skill activated: deploy (global)`, and its full instructions are loaded
into context. Frontmatter is optional — without it the name comes from the
filename and the description from the first line.

### Interactive questions

When a decision is genuinely yours, the agent can call the `ask_user` tool and
Polypus shows an **arrow-key picker** right in the terminal — single-choice, or
multi-select when the agent allows it. In headless mode (`--json`) there's no one
to answer, so the agent is told to proceed with a sensible default instead.

## Commands

| Command | Description |
| --- | --- |
| `polypus setup` | Interactive wizard (agents, keys, permissions). |
| `polypus init [--force]` | Scaffold a `.poly/` workspace (agents.md, skills, SDD spec template, README). |
| `polypus add-agent <name> --provider <p> --model <m> [--api-key ...] [--base-url ...] [--tool-mode auto\|native\|emulated] [--set-default]` | Register an agent. |
| `polypus remove-agent <name>` | Remove an agent. |
| `polypus list-agents` | List configured agents. |
| `polypus run [task] [--agent <name>] [--mode plan\|review\|bypass] [--max-steps <n>] [--fast\|--quality] [--verify\|--no-verify]` | Run a task, or open a REPL if no task is given. |
| `polypus swarm <task> [--agents a,b] [--max-subtasks <n>] [--fast\|--quality] [--verify\|--no-verify]` | Split a task across agents in parallel worktrees. |
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
/quality         quality profile: verify + plan-first + auto-context ON (default)
/fast            fast profile: that scaffolding OFF (cheapest, quickest)
/verify on|off   toggle running project checks before "done"
/planfirst on|off  toggle forcing a short plan before acting
/allow <glob>    add a path to the allow-list
/reset           clear the conversation
/help            list commands
/exit            quit
```

Pasting a large, multi-line block at the prompt is collapsed to a compact
`[Pasted text #1 +16 lines]` marker so it doesn't flood the terminal — the full
text is still sent to the agent. (Requires a terminal with bracketed paste, which
most modern terminals support.)

### Referencing files with `@`

Type `@` at the prompt to open a **file picker**: it lists the files in the
current directory and filters live as you keep typing (subsequence match, so
`srvc` finds `src/service.ts`). Move with ↑/↓, press **Enter** to insert the
chosen `@path`, or **Esc** to cancel. The referenced file's contents are then
injected into the task as context (same as typing `@path` by hand).

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

## Execution modes — making cheap/local models deliver

The hard part of using a cheap or local model as a coding agent isn't that it
errs more — it's that it errs **silently** (invents an API, edits the wrong
file, declares "done" without doing it). Polypus closes that gap with
engineering scaffolding that's **on by default**, so a weaker model produces
output you can actually trust:

- **Closed-loop verification.** When the agent calls `finish`, Polypus runs the
  project's own checks (`typecheck`/`build`/`test`/`lint` for Node; `cargo`,
  `go`, `pytest`/`ruff`/`mypy` for Rust/Go/Python) and hands any failure back to
  the agent to fix — it doesn't accept "done" until the project is actually
  green. In a **swarm**, a worker whose checks never pass is kept on its branch
  but **not merged**, so broken code never lands.
- **Plan-first.** The agent must write a short numbered plan and ground itself in
  the real files (read before edit) before acting — and there's an `update_plan`
  tool to keep that checklist current.
- **Proactive context.** Task-relevant code is injected automatically: the
  semantic index when embeddings are configured, otherwise a zero-setup keyword
  scan — so the model starts grounded even on Ollama with no index.

This costs some extra tokens and time. When you want the cheapest, fastest run
instead, switch to the **fast** profile, which turns all of the above off.

| Profile | Verification | Plan-first | Auto-context |
| --- | --- | --- | --- |
| `quality` (default) | on | on | on |
| `fast` | off | off | off |

```bash
polypus run "…"                 # quality by default
polypus run --fast "…"          # cheapest/quickest, scaffolding off
polypus run --no-verify "…"     # keep plan-first/context, skip the checks only
polypus swarm --fast "…"        # same switches apply to swarm
```

In the REPL, toggle live with `/quality`, `/fast`, `/verify on|off` and
`/planfirst on|off` (see `/help`). You can also set the defaults in
`~/.polypus/config.json`:

```json
{
  "execution": {
    "profile": "quality",
    "verify": true,
    "planFirst": true,
    "autoContext": true,
    "maxVerifyFixes": 3
  }
}
```

Precedence per setting: **CLI flag → config field → profile preset.** So
`--no-verify` always wins, a config field overrides the profile, and the profile
fills in the rest.

### Roadmap: prove it with numbers (`polypus eval`)

The claim "a cheap model delivers the equivalent" should be measurable, not a
slogan. Planned: a `polypus eval <suite>` command that runs a fixed set of tasks
through two agents (e.g. an expensive vs. a cheap model) on the **same** harness
and scores each by whether the project's checks pass (compiles / tests green /
correct diff), emitting a comparison table (success %, cost, time). It doubles as
an internal regression guard for the scaffolding above. Tracked as a roadmap item
(not yet implemented) — open an issue to pick it up.

## Permissions

| Mode | File writes | Commands |
| --- | --- | --- |
| `plan` | blocked | blocked |
| `review` | confirm each | confirm (unless pre-approved) |
| `bypass` | auto | auto |

All file access is restricted to the workspace and the configured **allow-list**
globs; the **deny-list** (e.g. `.git/**`, `**/.env`) always wins.

### Timeout Configuration

You can control the maximum duration of a swarm session using the environment variable `POLYPUS_SWARM_OVERALL_TIMEOUT_MS` (default: 1 hour). This prevents the session from hanging indefinitely if an agent stalls:

```bash
export POLYPUS_SWARM_OVERALL_TIMEOUT_MS=1800000  # 30 minutes
polypus swarm "your task"
```

Similarly, `POLYPUS_SWARM_IDLE_TIMEOUT_MS` controls the idle timeout for individual workers (default: 5 minutes).

The `run_python_script` tool has its own per-script timeout, configurable with `POLYPUS_PYTHON_TIMEOUT_MS` (default: 120000, i.e. 2 minutes). An absent or invalid value falls back to the default.

## Swarm (parallel agents)

```bash
polypus swarm "add a REST API and a matching test suite"
```

The lead agent splits the task into subtasks, each worker runs in its own git
worktree (in `bypass` mode, since the worktree is throwaway), and the branches
are merged back sequentially. Conflicting branches are kept for manual
inspection rather than force-merged.

## MCP (external tool servers)

Connect [Model Context Protocol](https://modelcontextprotocol.io) servers to give
the agent extra tools. Declare them in `.poly/mcp.json`:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    }
  }
}
```

On each run Polypus spawns the servers (stdio transport), lists their tools and
exposes them to the agent as `mcp__<server>__<tool>` — for both native and
emulated models. Servers that fail to start are skipped, the processes are shut
down when the run ends, and external MCP tools are disabled in `plan` mode.

## Autonomous agent — the tool self-improving 🤖

Polypus can run **itself** in CI to implement its own issues. Label an issue
`polypus-go` and the `agent.yml` workflow first **estimates** the effort/cost and
posts it as an issue comment. Nothing is implemented until the repo **owner**
comments `/polypus approve` on the issue — only the owner can approve. After that
it implements headlessly, gates on the local CI, patch-bumps the version +
CHANGELOG, and opens a release-ready PR; when you merge it, `auto-release.yml`
cuts the GitHub Release and `release.yml` publishes to npm.

```
issue + label `polypus-go`
  → agent.yml (estimate): posts the cost estimate as a comment
  → you (owner) comment `/polypus approve`
  → agent.yml (implement): cheap model → secret scan → CI gate → bump + CHANGELOG → open PR
  → you merge the PR
  → auto-release.yml → release.yml → npm publish
```

**Setup (one-time):**

```bash
# 1) the trigger label
gh label create polypus-go --color 5be4b1

# 2) the model key
gh secret set OPENROUTER_API_KEY --body "sk-or-v1-..."

# 3) a PAT (repo scope) so the agent can open the PR AND the release can publish
#    (a Release made with the default GITHUB_TOKEN does NOT trigger release.yml)
gh secret set POLYPUS_PR_TOKEN --body "github_pat_..."

# 4) optional: cheap model + per-run budget
gh variable set POLYPUS_AGENT_MODEL --body "deepseek/deepseek-chat-v3-0324"
gh variable set POLYPUS_BUDGET_USD  --body "0.50"
```

Guard-rails: own-repo only, secret scan on the diff, mandatory CI gate, a spend
budget, and your merge as the final gate. Without `POLYPUS_PR_TOKEN` nothing
breaks — the agent still implements and pushes a branch, and comments the branch
link on the issue instead of failing.

📖 **Full guide with a diagram, examples and the `POLYPUS_PR_TOKEN` walkthrough:**
[the autonomous-agent page](https://gaberrb.github.io/polypus/agent.html)
(`docs/agent.html`).

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
