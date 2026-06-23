# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.34] - 2026-06-23

### Changed
- core: biblioteca embarcavel (@gaberrb/polypus/lib) para o Cowork (#136)

## [0.4.33] - 2026-06-23

### Changed
- core: store de projetos recentes (~/.polypus/recent-projects.json) (#124)

## [0.4.32] - 2026-06-23

### Changed
- core: helper de info de git (isGitRepo/repoRoot/branch) (#125)

## [0.4.31] - 2026-06-23

### Changed
- core: health-check de provider (testConnection) para o onboarding do Cowork (#123)

### Added
- Health-check function `testConnection` for provider onboarding (#123)

## [0.4.30] - 2026-06-23

### Changed
- Índice do repositório + retrieval semântico (RAG) para seleção de contexto (#49)

## [0.4.29] - 2026-06-23

### Changed
- Corrige saída ilegível quando o agente responde/pergunta no meio do run (spinner vs streaming) (#110)

## [0.4.28] - 2026-06-22

### Changed
- shift tab para alternar os modos (#99)

## [0.4.27] - 2026-06-22

### Changed
- Referenciar arquivos via polypus (#97)

### Added
- Support for empty `@` mentions to list all files in the current directory. When a user types just `@`, Polypus will now list the contents of the current directory (`.`) as context, making it easier to reference files interactively. (#97)

## [0.4.26] - 2026-06-22

### Changed
- A busca de apis do OpenRouter (#91)

### Added
- Improved OpenRouter model search filters: added support for sorting by popularity (`popularity` and `popularity-desc`) and filtering by minimum popularity (`minPopularity`). Updated the CLI (`polypus models`) to include these options and enhanced the table legend to explain the new sorting criteria. (#91)

## [0.4.25] - 2026-06-22

### Added
- `--workers <n>` for swarm (CLI `polypus swarm` and the REPL `/swarm`): sets
  **both** the subtask count and the concurrency, so a **single agent** can fan
  out to N real **parallel** workers (overrides the per-endpoint cap). Previously
  one agent defaulted to 2 subtasks run **serially**, and `--workers` didn't
  exist. The REPL `/swarm` now parses `--workers N` out of the line.

### Fixed
- The agent no longer hangs trying to start long-running servers: `run_command`
  now **refuses** dev-server/watcher commands (`npm run dev`/`start`, `start /B
  node …`, `vite`, `nodemon`, `--watch`, …) — which never return and block the
  run until timeout, looping the agent — and tells it to use one-shot checks
  (`build`/`test`) instead. The system prompt also warns against starting servers.
  (the swarm hang reported with `start /B node dist/index.js`)

## [0.4.24] - 2026-06-22

### Fixed
- `auto-release.yml` failed to compile (and so never created the Release on merge)
  because a step referenced the `secrets` context in its `if:` — which isn't
  allowed and invalidated the whole workflow. Removed that step; merging a
  `polypus/issue-*` PR now creates the GitHub Release and publishes to npm as
  intended. (#83 follow-up)

## [0.4.23] - 2026-06-22

### Added
- Task generator: decompose a PRD into independent, parallelizable tasks with
  per-task model/usage/cost estimates (`src/core/agent/task-generator.ts`), plus a
  `.poly/skills/task-generation.md` skill documenting the workflow. Autonomously
  implemented by Polypus from issue #83. (#83)

## [0.4.22] - 2026-06-22

### Changed
- The autonomous agent's approval is now a **comment**, not a GitHub Environment
  reviewer. Labeling an issue `polypus-go` runs the `estimate` job (posts the cost
  estimate); the implementation only runs after the repo **owner** comments
  `/polypus approve` on the issue (`author_association == OWNER` — admin-only). No
  Environment/reviewer setup needed. (#83 follow-up)

## [0.4.21] - 2026-06-22

### Changed
- The project's `.poly/` workspace (agent operating instructions + skills) is now
  **tracked in git** instead of gitignored. As the scaffold README says, you can
  commit `.poly/` to standardize how AI agents work in the repo — and it means
  skills the autonomous agent creates under `.poly/skills/` become real, reviewable
  changes (a `.poly`-only run no longer shows up as "no changes"). Only `.poly/`
  was un-ignored; `.polypus/` stays ignored. (#83 follow-up)

## [0.4.20] - 2026-06-22

### Changed
- Swarm com 1 agente: o mesmo agente divide o trabalho em sub-agentes (sem exigir 3+ configurados) (#84)

## [0.4.19] - 2026-06-22

### Added
- **MCP (Model Context Protocol) support** — connect external tool servers.
  Declare them in `.poly/mcp.json` (`mcpServers: { name: { command, args, env } }`)
  and Polypus spawns each over the stdio transport, performs the JSON-RPC
  handshake, lists their tools and exposes them to the agent (native and
  emulated) namespaced as `mcp__<server>__<tool>`. Dependency-free minimal client
  (`src/core/mcp/`); servers that fail to start are skipped; spawned servers are
  shut down at the end of the run; external MCP tools are disabled in `plan`
  mode. Bilingual status line. (#52)

## [0.4.18] - 2026-06-22

### Added
- `polypus estimate "<task>"` — estimates the effort (complexity, steps, tokens)
  and the USD cost to implement a task, without making any changes. `--json` for
  a machine-readable contract.
- The autonomous `agent.yml` now runs in two jobs: **estimate** (posts the cost
  estimate as an issue comment and derives a step budget) and **implement**,
  which is gated behind an `autonomous-agent` Environment so it waits for your
  **manual approval** before doing anything. There is no spend cap by design —
  the estimate plus your approval are the control. (follow-up to #61)

## [0.4.17] - 2026-06-22

### Added
- Docs for the autonomous agent: a dedicated, detailed page (`docs/agent.html`)
  with an end-to-end diagram, examples, the guard-rails, and a step-by-step
  `POLYPUS_PR_TOKEN` setup guide — framed around the tool self-improving. Linked
  from the site nav and the CI/CD page (which now lists `agent.yml` /
  `auto-release.yml` and the `POLYPUS_PR_TOKEN` secret), and summarized in the
  README with the one-time setup. (follow-up to #61)

## [0.4.16] - 2026-06-22

### Added
- The autonomous `agent.yml` workflow now does the **full release cycle**: after
  the CI gate it patch-bumps the version and updates the CHANGELOG
  (`scripts/prepare-release.mjs`) and regenerates `context.md`, so the PR it opens
  is release-ready. A new `auto-release.yml` then **creates the GitHub Release
  when that PR is merged** (branch `polypus/issue-*`), which triggers
  `release.yml` → `npm publish`. So labeling an issue `polypus-go` and merging the
  resulting PR ships the change to npm end-to-end. Auto-release needs a
  `POLYPUS_PR_TOKEN` PAT so the created Release triggers the publish workflow.
  (follow-up to #61)

## [0.4.15] - 2026-06-21

### Fixed
- The autonomous `agent.yml` workflow no longer fails at the "Open the pull
  request" step when GitHub Actions isn't permitted to create PRs. It now uses
  an optional `POLYPUS_PR_TOKEN` PAT when present, and otherwise degrades
  gracefully: the run stays green and posts the branch compare link as an issue
  comment instead of erroring. (follow-up to #61)

## [0.4.14] - 2026-06-21

### Added
- Autonomous implementation workflow (`.github/workflows/agent.yml`). Label an
  issue `polypus-go` (opt-in) and a runner executes Polypus headlessly
  (`run --mode bypass --verify --json --budget`) to implement it, gates on the
  local CI (typecheck/build/test), and opens a PR titled `feat: … (Closes #N)`.
  The model is a configurable cheap OpenRouter model (`POLYPUS_AGENT_MODEL`
  repo variable, default DeepSeek V3) with a per-run USD budget
  (`POLYPUS_BUDGET_USD`, default 0.50). Guard-rails: runs only on the project's
  own repo and refuses to open a PR if a secret is detected in the diff. Builds
  on the headless `--json` (#62), `--verify` (#54) and budget (#59) features.
  Evaluating review-bot feedback to cut false positives is tracked as a
  follow-up. (#61)

## [0.4.13] - 2026-06-21

### Added
- Streaming model responses. OpenAI-compatible providers (OpenRouter, Ollama,
  generic gateways) now stream the answer token-by-token instead of waiting for
  the whole completion: text appears live and ESC interrupts mid-generation
  rather than only between steps. Implemented via an optional `onDelta` callback
  on `ChatRequest` and an `onAssistantDelta` agent event; streamed tool-call
  deltas are aggregated by index. Active in native tool mode (emulated stays
  non-streaming so its XML protocol isn't shown raw, and `--json` keeps its
  single-object output). The native Anthropic provider falls back to
  non-streaming. Bilingual (en/pt-BR). (#57)

## [0.4.12] - 2026-06-21

### Changed
- Swarm reliability overhaul (`polypus swarm` and the REPL `/swarm`):
  - **End-to-end cancellation:** `AbortSignal` is threaded through
    `runSwarm → runWorker → runAgent` (and `decompose`); ESC/Ctrl+C now cancels
    via the shared `listenForCancel` (extracted to `src/ui/cancel.ts`). On
    cancel, already-committed workers still merge and the rest are cleaned up.
  - **Per-worker idle timeout:** a watchdog (reset on each step) aborts a worker
    that stops making progress (`POLYPUS_SWARM_IDLE_TIMEOUT_MS`, default 5 min)
    instead of hanging the whole run.
  - **Resilience:** workers never reject — a failed/aborted worker yields an
    unfinished outcome, so the merge loop for committed workers always runs.
  - **Automatic concurrency cap:** a bounded pool runs at most N workers, where
    `recommendConcurrency` sums per-endpoint capacity (local Ollama capped at 2,
    hosted runs all) — avoiding the local contention that could freeze a run. (#46)

## [0.4.11] - 2026-06-21

### Added
- Custom tools and hooks, declared in `.poly/` — extend Polypus without touching
  the core:
  - **Custom tools** (`.poly/tools/*.json`: `name`, `description`, `parameters`
    schema, `command` template with `{arg}` placeholders) are loaded into the
    agent's tool set for both native and emulated modes and run through the
    permission engine.
  - **Hooks** (`.poly/hooks.json`): `afterWrite`/`afterEdit`/`afterTool` run a
    shell command after a successful tool (e.g. `npx prettier -w {path}` to
    format on save), and `beforeCommand.deny` blocks `run_command` calls
    containing any listed substring.
  Bilingual (en/pt-BR). (#53)

## [0.4.10] - 2026-06-21

### Added
- Automatic context compaction for long sessions. When the prompt grows past a
  token threshold (default 120k, set `POLYPUS_COMPACT_THRESHOLD` or disable with
  `POLYPUS_NO_COMPACT`), Polypus summarizes the older middle of the conversation
  into a single brief — preserving the system prompt and the most recent turns —
  so long tasks don't overflow the context window or get needlessly expensive.
  The cut is chosen so it never orphans a tool-call/result pair. Shows
  `↯ context compacted: ~120k → ~28k tokens`. Bilingual (en/pt-BR). (#51)

## [0.4.9] - 2026-06-21

### Added
- Session persistence and resume. Each task now saves the conversation to
  `~/.polypus/sessions/<id>.json` (agent, mode, messages — with secrets redacted
  on save). `polypus run --continue` resumes the most recent session and
  `polypus run --resume <id>` a specific one; `polypus sessions` lists them. In
  the REPL, `/sessions` lists and `/resume <id>` switches. So a long task no
  longer has to start from zero after you quit. Bilingual (en/pt-BR). (#56)

## [0.4.8] - 2026-06-21

### Added
- Token budget + cost analytics. Runs now show an estimated USD cost next to the
  token count (using the OpenRouter price catalog for OpenRouter agents). A new
  `--budget <usd>` flag stops the run via the existing abort signal once the
  estimated session spend reaches the cap. Every run is appended to
  `~/.polypus/usage.jsonl`, and `polypus usage` aggregates tokens and cost per
  day with a grand total. Cost is simply omitted when pricing is unknown
  (e.g. local Ollama). Bilingual (en/pt-BR). (#59)

## [0.4.7] - 2026-06-21

### Added
- Test-driven verification loop: `polypus run "<task>" --verify` runs the
  project's checks after the agent calls `finish` (auto-detected from
  `package.json`: `typecheck`, `build`, `test`) and, if any fail, feeds the
  output back to the agent to fix — iterating until green or a retry budget
  (3 fixes) is exhausted. Turns "generated code" into "code that actually
  builds and passes its tests". Opt-in so it never adds cost unless requested.
  Bilingual (en/pt-BR). (#54)

## [0.4.6] - 2026-06-21

### Added
- Diff/hunk approval in `review` mode: before a `write_file`/`edit_file` is
  applied, Polypus now shows the **real colored unified diff** (instead of a
  one-line summary) and lets you approve all, reject, or — when the change has
  more than one hunk — pick exactly which hunks to apply. Only the approved
  hunks are written. Backed by a dependency-free line diff
  (`src/core/permissions/diff.ts`) and a richer confirmation contract that can
  return the reconstructed content. Degrades safely to whole-file approval when
  there is a single hunk. Bilingual (en/pt-BR). (#58)

## [0.4.5] - 2026-06-21

### Added
- Safety policy layer (`src/core/permissions/policy.ts`): a deny-list of
  obviously destructive shell commands (`rm -rf /`, fork bomb, `mkfs`,
  `dd of=/dev/sd*`, `curl … | sh`, `chmod 777 /`, …) is now refused in **every**
  permission mode, including `bypass`. File writes are scanned for hard-coded
  secrets (private-key blocks, AWS access keys, GitHub/Slack/OpenAI/Google
  tokens) and blocked with guidance to use an environment variable instead —
  also in all modes. Conservative patterns keep false positives low. Bilingual
  messages (en/pt-BR). (#63)

## [0.4.4] - 2026-06-21

### Added
- Headless/JSON mode: `polypus run "<task>" --json` emits a single JSON object
  (`{ result, events }`) instead of the colored TUI — with the run reason, step
  count, summary, `filesChanged` (derived from successful `write_file`/`edit_file`
  calls), token usage, and a structured event log. Gives CI and scripts a stable
  contract to parse (`… --json | jq '.result.filesChanged'`) instead of scraping
  colored text. Intended for use with `--mode bypass` (no TTY for confirmations).
  Bilingual help/error strings. (#62)

## [0.4.3] - 2026-06-21

### Added
- `@`-mentions: reference files and directories directly in a task or REPL prompt
  (e.g. `fix the bug in @src/ui/banner.ts following @.poly/skills/`). Polypus
  resolves each `@path` against the allow-list and injects the file contents
  (truncated) or directory listing into the task as explicit context, so you no
  longer have to describe paths in prose and hope the agent opens the right file.
  Missing or denied paths are skipped with an inline note. Bilingual (en/pt-BR).
  (#50)

## [0.4.2] - 2026-06-21

### Added
- New `search` tool for the agent: regex content search across the workspace
  (grep/ripgrep-style), returning `path:line: snippet`. It respects the
  allow/deny-list (same gating as `read_file`), skips `node_modules`/`.git` and
  other generated directories, supports an optional `glob` filter and
  `max_results` cap, and skips binary/oversized files. Pure-Node so it is
  portable and deterministic — the agent no longer has to grep via `run_command`
  or read files blindly to find where something is used. (#48)

## [0.4.1] - 2026-06-18

### Added
- `/swarm <task>` slash command in the interactive REPL — runs a task as a
  parallel swarm (same 3+ agent gate and live dashboard as `polypus swarm`),
  so you no longer have to leave the session to use it. Shows in `/help`. (#41)
- Large pastes in the REPL are now captured as a whole via bracketed paste and
  shown compactly as `[Pasted text #N +M lines]`, while the full text is still
  sent to the agent — so a multi-line paste no longer gets split into several
  prompts or truncated. Falls back cleanly when bracketed paste isn't available. (#42)

## [0.4.0] - 2026-06-18

### Added
- Project operating instructions are now auto-loaded into the agent's system
  prompt: on a fresh run Polypus reads `.poly/agents.md` (or `AGENTS.md` at the
  root) and injects it, telling the agent the referenced paths are relative to
  `.poly/` so it follows the repo's conventions instead of guessing. (#33)
- `polypus init` — scaffold a `.poly/` workspace in the current directory with a
  didactic starter set: `agents.md` (role + golden rules + skills index),
  `skills/` (coding + spec-driven), a lean Spec-Driven Development template
  (`templates/spec.md`) and a `README.md`. Idempotent (existing files are kept;
  `--force` overwrites), with locale-aware content (en / pt-BR). Pairs with the
  auto-loading of `.poly/agents.md` so a fresh project follows its conventions
  out of the box. Docs and site updated. (#37)

### Changed
- `polypus swarm` now requires **3 or more configured agents**; with fewer it
  fails fast with a clear message (swarm degenerates into a single-agent run
  otherwise). The `--help` description states the requirement. (#34)

### Fixed
- The startup banner showed a hardcoded `v0.1.0` instead of the real version.
  It now reads the version from `package.json` (shared via `src/core/version.ts`,
  the single source of truth also used by `polypus --version`), so the banner and
  `--version` always match. (#32)

## [0.3.0] - 2026-06-18

### Added
- Live swarm dashboard: `polypus swarm` now renders the orchestrator plus a row
  per worker with its status, current action and step count, redrawn in place
  (with a plain-text fallback when output is piped). (#21)
- `context.md` (living project summary with an auto-generated, CI-verified module
  map) and `rules.md` (project conventions and what is/isn't expected). The PRD
  and review bots now load them as grounding context to improve their output,
  the docs site links them as essential reading, and `npm run context`
  regenerates the module map. (#22)

## [0.2.2] - 2026-06-17

### Added
- `polypus prd <issue#>` — generate a structured PRD from a GitHub issue using a
  free OpenRouter model, plus a `prd-bot` GitHub Actions workflow that posts the
  PRD as a comment when an issue is labeled `accepted`. (#12)
- `polypus review <pr#>` — automated first-pass code review of a PR diff using a
  free OpenRouter model, plus a `pr-review` workflow that comments on opened and
  reopened PRs. (#15)
- Docs site: an interactive CI/CD page (`docs/cicd.html`) with a clickable
  pipeline diagram and YAML examples, plus Contributing and Changelog sections
  and feature cards reflecting the auto-correction, PRD and review agents. (#23)

### Changed
- Hardened the `prd`/`review` commands: numeric issue/PR ref validation, a
  fail-fast guard when `--input -` is used without a pipe, and a configurable
  diff cap via `POLYPUS_MAX_DIFF_CHARS`. (#16)

### Fixed
- `write_file` no longer dead-loops when the model's response is truncated at the
  output token limit (so `content` arrives empty/partial and the call fails with
  `Received: [path]`). The agent loop now detects the cut-off (`finishReason`
  length/max_tokens) and tells the model to write large files in smaller pieces
  instead of resending the same oversized output. (#25)

## [0.2.1] - 2026-06-17

### Fixed
- The CLI now reads its version from `package.json` instead of a hardcoded
  string, so `polypus --version` stays in sync with releases. (#11)

## [0.2.0] - 2026-06-17

### Added
- Auto-correction layer for failed tool calls: on failure the raw error is
  enriched with its likely cause and missing context (real file contents, nearby
  paths, the editable allow-list, or the tool schema) so the model can self-heal
  instead of looping. (#7)

### Changed
- CI pipeline, issue-gated PR workflow, and OSS governance docs.
- Package scoped for npm publishing as `@gaberrb/polypus`.

## [0.1.0] - Initial release

### Added
- Agentic coding harness with a tool-using agent loop (`read_file`, `write_file`,
  `edit_file`, `run_command`, `list_dir`).
- Provider support: OpenRouter, Ollama, native Anthropic, and generic
  OpenAI-compatible endpoints.
- Tool-calling for models without native function-calling via an XML tool
  protocol injected into the prompt and parsed back (emulated mode).
- OpenRouter model discovery with price/context/tool filters (`polypus models`).
- Parallel swarm: a lead agent decomposes a task and workers run concurrently in
  isolated git worktrees, merging at the end (`polypus swarm`).
- Permission modes (`plan` / `review` / `bypass`) with a path allow-list.
- Interactive TUI: animated banner, thinking spinner, ESC-to-cancel, REPL.
- Secret loading from `~/.polypus/.env` and `./.env`.
- Bilingual interface (Portuguese pt-BR default, English).

[Unreleased]: https://github.com/GaberRB/polypus/compare/v0.4.34...HEAD
[0.4.34]: https://github.com/GaberRB/polypus/compare/v0.4.33...v0.4.34
[0.4.33]: https://github.com/GaberRB/polypus/compare/v0.4.32...v0.4.33
[0.4.32]: https://github.com/GaberRB/polypus/compare/v0.4.31...v0.4.32
[0.4.31]: https://github.com/GaberRB/polypus/compare/v0.4.30...v0.4.31
[0.4.30]: https://github.com/GaberRB/polypus/compare/v0.4.29...v0.4.30
[0.4.29]: https://github.com/GaberRB/polypus/compare/v0.4.28...v0.4.29
[0.4.28]: https://github.com/GaberRB/polypus/compare/v0.4.27...v0.4.28
[0.4.27]: https://github.com/GaberRB/polypus/compare/v0.4.26...v0.4.27
[0.4.26]: https://github.com/GaberRB/polypus/compare/v0.4.25...v0.4.26
[0.4.25]: https://github.com/GaberRB/polypus/compare/v0.4.24...v0.4.25
[0.4.24]: https://github.com/GaberRB/polypus/compare/v0.4.23...v0.4.24
[0.4.23]: https://github.com/GaberRB/polypus/compare/v0.4.22...v0.4.23
[0.4.22]: https://github.com/GaberRB/polypus/compare/v0.4.21...v0.4.22
[0.4.21]: https://github.com/GaberRB/polypus/compare/v0.4.20...v0.4.21
[0.4.20]: https://github.com/GaberRB/polypus/compare/v0.4.19...v0.4.20
[0.4.19]: https://github.com/GaberRB/polypus/compare/v0.4.18...v0.4.19
[0.4.18]: https://github.com/GaberRB/polypus/compare/v0.4.17...v0.4.18
[0.4.17]: https://github.com/GaberRB/polypus/compare/v0.4.16...v0.4.17
[0.4.16]: https://github.com/GaberRB/polypus/compare/v0.4.15...v0.4.16
[0.4.15]: https://github.com/GaberRB/polypus/compare/v0.4.14...v0.4.15
[0.4.14]: https://github.com/GaberRB/polypus/compare/v0.4.13...v0.4.14
[0.4.13]: https://github.com/GaberRB/polypus/compare/v0.4.12...v0.4.13
[0.4.12]: https://github.com/GaberRB/polypus/compare/v0.4.11...v0.4.12
[0.4.11]: https://github.com/GaberRB/polypus/compare/v0.4.10...v0.4.11
[0.4.10]: https://github.com/GaberRB/polypus/compare/v0.4.9...v0.4.10
[0.4.9]: https://github.com/GaberRB/polypus/compare/v0.4.8...v0.4.9
[0.4.8]: https://github.com/GaberRB/polypus/compare/v0.4.7...v0.4.8
[0.4.7]: https://github.com/GaberRB/polypus/compare/v0.4.6...v0.4.7
[0.4.6]: https://github.com/GaberRB/polypus/compare/v0.4.5...v0.4.6
[0.4.5]: https://github.com/GaberRB/polypus/compare/v0.4.4...v0.4.5
[0.4.4]: https://github.com/GaberRB/polypus/compare/v0.4.3...v0.4.4
[0.4.3]: https://github.com/GaberRB/polypus/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/GaberRB/polypus/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/GaberRB/polypus/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/GaberRB/polypus/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/GaberRB/polypus/compare/v0.2.2...v0.3.0
[0.2.2]: https://github.com/GaberRB/polypus/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/GaberRB/polypus/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/GaberRB/polypus/releases/tag/v0.2.0
[0.1.0]: https://github.com/GaberRB/polypus/tree/616e9d7
