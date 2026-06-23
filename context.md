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
- `auto-release.yml` — ao **mergear** um PR de branch `polypus/issue-*` na main, cria o
  GitHub Release da versão do `package.json` (com `POLYPUS_PR_TOKEN`), fechando o ciclo
  issue→PR→release.
- `release.yml` — publica no npm ao publicar um GitHub Release.

## Comandos principais

`polypus setup` · `run` · `swarm` · `models` · `add-agent`/`list-agents` · `prd <issue#>` ·
`review <pr#>`.

## Rodar e testar

```bash
npm ci && npm run build
npm run typecheck && npm test
npm run context        # regenera o mapa de módulos abaixo
```

## Mapa de módulos

<!-- AUTO:BEGIN (gerado por `npm run context`; não editar à mão) -->

_85 módulos em `src/`._

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
- `swarm.ts`
- `usage.ts`

### `src/core`
- `version.ts`

### `src/core/agent`
- `compaction.ts`
- `concurrency.ts`
- `correction.ts`
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
- `schema.ts`
- `store.ts`

### `src/core/context`
- `mentions.ts`

### `src/core/git`
- `worktree.ts`

### `src/core/i18n`
- `index.ts` — Minimal zero-dependency i18n. Default locale is pt-BR; English is available.

### `src/core/mcp`
- `client.ts`
- `index.ts`

### `src/core/permissions`
- `allowlist.ts`
- `diff.ts` — Minimal line-based diff (LCS) grouped into hunks, used to show the real change
- `modes.ts`
- `policy.ts` — Safety policy shared by the permission engine: a deny-list of obviously

### `src/core/protocol`
- `driver.ts`
- `emulated.ts`
- `native.ts`
- `parser.ts`
- `system-prompt.ts`

### `src/core/providers`
- `anthropic.ts`
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

### `src/core/tools`
- `custom.ts`
- `edit-file.ts`
- `list-dir.ts`
- `read-file.ts`
- `registry.ts`
- `retrieve.ts`
- `run-command.ts`
- `search-file.ts`
- `types.ts`
- `write-file.ts`

### `src/core/util`
- `git-info.ts`

### `src/ui`
- `banner.ts`
- `cancel.ts`
- `line-reader.ts`
- `paste.ts` — Bracketed-paste handling for the REPL. When a terminal has bracketed paste
- `repl.ts`
- `spinner.ts`
- `swarm-view.ts`
- `wizard.ts`

<!-- AUTO:END -->
