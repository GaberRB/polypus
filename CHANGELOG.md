# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/GaberRB/polypus/compare/v0.4.5...HEAD
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
