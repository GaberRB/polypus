# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- `polypus swarm` now requires **3 or more configured agents**; with fewer it
  fails fast with a clear message (swarm degenerates into a single-agent run
  otherwise). The `--help` description states the requirement. (#34)

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

[Unreleased]: https://github.com/GaberRB/polypus/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/GaberRB/polypus/compare/v0.2.2...v0.3.0
[0.2.2]: https://github.com/GaberRB/polypus/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/GaberRB/polypus/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/GaberRB/polypus/releases/tag/v0.2.0
[0.1.0]: https://github.com/GaberRB/polypus/tree/616e9d7
