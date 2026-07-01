# context.md — resumo do Polypus

> Resumo vivo do projeto, para humanos e para IA. O **mapa de módulos** abaixo é
> **auto-gerado** (`npm run context`) e verificado no CI. Para premissas e padrões de
> codificação, veja [`rules.md`](rules.md).

## O que é

**Polypus** é um *harness* de codificação agêntico: faz **qualquer** API de IA gerar e
aplicar código — inclusive modelos **sem function-calling** — lendo e editando arquivos e
rodando comandos em um diretório de projeto real. Provedores: OpenRouter, Ollama, Anthropic
nativo e qualquer endpoint OpenAI-compatible. Roda um agente, ou divide a tarefa entre
**vários agentes em paralelo** (swarm) em git worktrees isoladas.

## Como funciona (visão geral)

1. **Prompt → contexto.** O harness monta um system prompt (papel, workspace, modo de
   permissão, idioma) e o histórico.
2. **Tools, nativas ou emuladas.** Modelos com function-calling recebem as tools pela API
   (`native`); os sem recebem um protocolo XML no prompt e o Polypus parseia a saída
   (`emulated`) — assim até modelos locais escrevem arquivos.
3. **Parser + permissões.** Um parser tolerante extrai as tool calls; cada ação passa pelo
   modo (`plan`/`review`/`bypass`) e por uma allow-list de caminhos.
4. **Loop ReAct.** O resultado da tool realimenta o modelo até `finish`. Falhas idênticas
   param sozinhas; respostas truncadas e erros recebem **autocorreção**.
5. **Swarm.** Um agente líder decompõe a tarefa; workers rodam em paralelo em worktrees e os
   branches são mesclados ao final.
6. **Retrieval (RAG).** `polypus index` constrói um índice semântico do repositório (chunking
   + embeddings via Ollama/OpenAI-compatible) em `~/.polypus/index/<repo-hash>/`; `polypus
   retrieve` e a injeção opt-in de contexto selecionam trechos por significado.
7. **Streaming headless.** `run --json --stream` emite eventos NDJSON ao vivo (tokens, tool
   calls, resultado) para UIs externas; `run --json` mantém o objeto único final.

## Automação (GitHub Actions)

- `ci.yml` — typecheck + build + testes (Node 20/22) e a checagem de `context.md`.
- `require-issue.yml` — PRs precisam citar uma issue com label `accepted`.
- `prd-bot.yml` / `pr-review.yml` — agentes de PRD e de code review (modelos gratuitos do
  OpenRouter) que usam **`context.md` e `rules.md` como contexto**.
- `agent.yml` — ao rotular uma issue com `polypus-go`, roda o Polypus headless
  (`run --mode bypass --verify --json --budget`) num runner, valida na CI local, **faz o
  patch bump + CHANGELOG** (`scripts/prepare-release.mjs`) e abre um PR com `Closes #N`.
  Modelo barato configurável (`POLYPUS_AGENT_MODEL`), guard-rails de repo próprio + scan de
  segredos no diff.
- `auto-release.yml` — gateado por **versão**: em **push na main**, cria o GitHub Release
  quando a versão do `package.json` ainda não tem release/tag (idempotente, com
  `POLYPUS_PR_TOKEN`). Cobre PRs do agente, manuais e dependabot.
- `release.yml` — publica no npm ao publicar um GitHub Release.

## Comandos principais

`polypus setup` · `run` (`--json`/`--stream`/`--verify`/`--budget`) · `swarm` · `models` ·
`add-agent`/`list-agents` · `index`/`retrieve` (RAG) · `prd <issue#>` · `review <pr#> [--json]` ·
`estimate`.

## Biblioteca embarcável (`@gaberrb/polypus/lib`)

Além do CLI, o pacote publica um entry de biblioteca (`dist/lib.js` + `dist/lib.d.ts`, via
`exports`) com APIs do core para hosts embarcarem o Polypus in-process: config/agentes
(`loadConfig`/`saveConfig`/`upsertAgent`), `setEnvVar`, `chatOnce`, `testConnection`,
sessions/recent-projects/git-info, e o catálogo de modelos do OpenRouter
(`listOpenRouterModels`/`filterModels`).

## Polypus Cowork (desktop)

App desktop em `apps/desktop/` (**Electron + React + Vite**, pacote próprio
`@gaberrb/polypus-cowork`) que reusa o core via o entry de biblioteca e os comandos headless.
Navegação **Chat / Cowork / Code**, sidebar (projetos/sessões), **Settings** (chaves no
`~/.polypus/.env` + Model Picker do OpenRouter + testar conexão), seletor de pasta de projeto,
execução com **streaming ao vivo** (timeline de tool calls + tokens), painel de **RAG** e tema
claro/escuro + i18n. (`cd apps/desktop && npm i && npm run dev`.)

## Rodar e testar

```bash
npm ci && npm run build
npm run typecheck && npm test
npm run context        # regenera o mapa de módulos abaixo
```

## Mapa de módulos

<!-- AUTO:BEGIN (gerado por `npm run context`; não editar à mão) -->

_120 módulos em `src/`._

### `src`
- `lib.ts` — Public library surface for embedders of Polypus (e.g. the Cowork desktop app).

### `src/cli`
- `index.ts`

### `src/cli/commands`
- `add-agent.ts`
- `cli-io.ts`
- `estimate.ts`
- `init.ts`
- `json-output.ts`
- `list-agents.ts`
- `models.ts`
- `prd.ts`
- `remove-agent.ts`
- `repo-index.ts`
- `retrieve.ts`
- `review.ts`
- `run.ts`
- `sessions.ts`
- `setup.ts`
- `stream-ask.ts`
- `stream-confirm.ts`
- `swarm.ts`
- `usage.ts`
- `web-server.ts` — `polypus web-server` — WebSocket server that lets the Chrome extension

### `src/core`
- `version.ts`

### `src/core/agent`
- `chat.ts`
- `checkpoints.ts`
- `compaction.ts`
- `concurrency.ts`
- `correction.ts`
- `diagnostics.ts`
- `estimate.ts`
- `free-provider.ts`
- `hooks.ts`
- `loop.ts`
- `orchestrator.ts`
- `prd.ts`
- `project-context.ts`
- `review.ts`
- `session-store.ts`
- `task-generator.ts`
- `usage.ts`
- `verify.ts`
- `worker.ts`

### `src/core/config`
- `dotenv.ts`
- `recent-projects.ts`
- `schema.ts`
- `store.ts`

### `src/core/context`
- `auto-context.ts`
- `keyword.ts`
- `mentions.ts`

### `src/core/git`
- `worktree.ts`

### `src/core/i18n`
- `index.ts` — Minimal zero-dependency i18n. Default locale is pt-BR; English is available.

### `src/core/mcp`
- `client.ts`
- `index.ts`

### `src/core/net`
- `html.ts` — Dependency-free HTML helpers. Good enough to feed page text to a model without
- `safe-fetch.ts` — Hardened HTTP client for the network tools (web_search/web_fetch/download).

### `src/core/net/search`
- `duckduckgo.ts` — DuckDuckGo search provider — keyless. Hits the no-JS HTML endpoint and scrapes

### `src/core/permissions`
- `allowlist.ts`
- `diff.ts` — Minimal line-based diff (LCS) grouped into hunks, used to show the real change
- `modes.ts`
- `policy.ts` — Safety policy shared by the permission engine: a deny-list of obviously

### `src/core/protocol`
- `curl-parser.ts` — Parse a cURL command string into its components.
- `custom-driver.ts` — CustomDriver — protocol driver exclusively for user-defined custom providers.
- `driver.ts`
- `emulated.ts`
- `jsonpath.ts` — Minimal JSONPath evaluator — no external dependencies.
- `native.ts`
- `parser.ts`
- `system-prompt.ts`

### `src/core/providers`
- `anthropic.ts`
- `custom-test.ts`
- `custom.ts`
- `defaults.ts`
- `health.ts`
- `ollama.ts` — Discovery helpers for a local Ollama instance.
- `openai-compatible.ts`
- `openrouter.ts` — Discovery + filtering for OpenRouter's public model catalog.
- `registry.ts`
- `types.ts` — Unified chat/tool abstraction shared by every provider and both tool paths.

### `src/core/retrieval`
- `chunker.ts` — A contiguous slice of a file, the unit that gets embedded and retrieved.
- `embedder.ts`
- `indexer.ts`
- `retriever.ts`
- `store.ts`

### `src/core/scaffold`
- `init.ts`
- `templates.ts`

### `src/core/skills`
- `index.ts`

### `src/core/tools`
- `apply-patch.ts`
- `ask-user.ts`
- `code-outline.ts`
- `custom.ts`
- `delete-file.ts`
- `download.ts`
- `edit-file.ts`
- `file-stats.ts`
- `find-files.ts`
- `list-dir.ts`
- `move-file.ts`
- `read-file.ts`
- `registry.ts`
- `retrieve.ts`
- `run-command.ts`
- `run-python-script.ts`
- `search-file.ts`
- `types.ts`
- `update-plan.ts`
- `web-fetch.ts`
- `web-search.ts`
- `web.ts` — Ferramentas web (navegador) — registradas no core do Polypus.
- `write-file.ts`

### `src/core/util`
- `git-info.ts`

### `src/ui`
- `banner.ts`
- `cancel.ts`
- `file-picker.ts`
- `line-reader.ts`
- `paste.ts` — Bracketed-paste handling for the REPL. When a terminal has bracketed paste
- `repl.ts`
- `slash-picker.ts`
- `spinner.ts`
- `swarm-view.ts`
- `wizard.ts`

<!-- AUTO:END -->
