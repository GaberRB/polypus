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

_53 módulos em `src/`._

### `src/cli`
- `index.ts`

### `src/cli/commands`
- `add-agent.ts`
- `cli-io.ts`
- `init.ts`
- `list-agents.ts`
- `models.ts`
- `prd.ts`
- `remove-agent.ts`
- `review.ts`
- `run.ts`
- `setup.ts`
- `swarm.ts`

### `src/core/agent`
- `correction.ts`
- `free-provider.ts`
- `loop.ts`
- `orchestrator.ts`
- `prd.ts`
- `project-context.ts`
- `review.ts`
- `worker.ts`

### `src/core/config`
- `dotenv.ts`
- `schema.ts`
- `store.ts`

### `src/core/git`
- `worktree.ts`

### `src/core/i18n`
- `index.ts` — Minimal zero-dependency i18n. Default locale is pt-BR; English is available.

### `src/core/permissions`
- `allowlist.ts`
- `modes.ts`

### `src/core/protocol`
- `driver.ts`
- `emulated.ts`
- `native.ts`
- `parser.ts`
- `system-prompt.ts`

### `src/core/providers`
- `anthropic.ts`
- `defaults.ts`
- `ollama.ts` — Discovery helpers for a local Ollama instance.
- `openai-compatible.ts`
- `openrouter.ts` — Discovery + filtering for OpenRouter's public model catalog.
- `registry.ts`
- `types.ts` — Unified chat/tool abstraction shared by every provider and both tool paths.

### `src/core/scaffold`
- `init.ts`
- `templates.ts`

### `src/core/tools`
- `edit-file.ts`
- `list-dir.ts`
- `read-file.ts`
- `registry.ts`
- `run-command.ts`
- `types.ts`
- `write-file.ts`

### `src/ui`
- `banner.ts`
- `repl.ts`
- `spinner.ts`
- `swarm-view.ts`
- `wizard.ts`

<!-- AUTO:END -->
