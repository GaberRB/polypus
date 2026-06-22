# skill: coding (padrões técnicos do Polypus)

Condicionamento técnico para implementar bem. Leia também [`../rules.md`](../rules.md) e
[`../context.md`](../context.md) (mapa de módulos).

## Stack e regras base

- **TypeScript + Node ≥ 20, ESM.** Imports relativos **sempre com `.js`** (mesmo para `.ts`).
- `tsup` (build), `vitest` (testes), `zod` (validação). Camadas: `src/core` (puro) não
  depende de `src/cli`/`src/ui`.
- Comentários explicam o **porquê**, em inglês, densidade similar ao redor.

## Adicionar uma tool

1. Novo arquivo em `src/core/tools/<nome>.ts` implementando `Tool`:
   `{ spec: { name (snake_case), description, parameters (JSON Schema) }, mutating, run() }`.
2. `run` valida args com `zod`, checa permissão (`ctx.permissions.authorizeWrite/Read`) se
   `mutating`, e **nunca lança**: retorna `{ ok: boolean, output: string }`.
3. Registre em `src/core/tools/registry.ts` (`TOOLS`). O `toolSpecs()` expõe ao modelo
   automaticamente (nativo) e o emulado documenta no system prompt.
4. Teste em `test/`.

## Adicionar um comando CLI

1. `src/cli/commands/<cmd>.ts` exportando a função do comando.
2. Registre em `src/cli/index.ts` (`buildProgram`), espelhando `models`/`swarm`/`prd`.
   Descrições/labels via `t("cli.cmd.<x>")`.
3. Helpers de IO compartilhados em `src/cli/commands/cli-io.ts` (`numericRef`, `readStdin`
   com guard de TTY, `stripBom`, `readProjectGuide`).
4. Comandos não-interativos (CI) leem env (ex.: `OPENROUTER_API_KEY`), aceitam `--out` e
   `--input <arquivo|->`. Mensagem de sucesso em **stderr**; conteúdo em **stdout**.

## i18n

Toda string de UI: chave nos **dois** catálogos (`en` e `pt-BR`) em
`src/core/i18n/index.ts`; use `t("chave", { params })`. Nunca hardcode texto visível.

## Providers e protocolo

- `Provider.chat(req) → ChatResponse` (normalize `content`, `toolCalls`, **`finishReason`**,
  `usage`). `finishReason` `"length"`/`"max_tokens"` = **truncado** (importante para a
  autocorreção).
- Caminhos de tool: **native** (function-calling via API) e **emulated** (protocolo XML no
  prompt + parser tolerante em `src/core/protocol/parser.ts`). **Não quebre o emulated.**
- `recoverArgs` (openai-compatible) recupera args de JSON malformado/truncado.

## Loop do agente e autocorreção

- `src/core/agent/loop.ts`: loop ReAct. Guardas que evitam loop infinito —
  `failStreak`/`maxToolRetries` (3 falhas idênticas), `maxReprompts`, `maxSteps`.
- Em falha de tool, a **autocorreção** (`correction.ts`) enriquece o erro com causa +
  contexto (conteúdo real do arquivo, paths próximos, allow-list, schema; e **truncamento** →
  "escreva o arquivo em partes"). Híbrida: determinística primeiro, escala p/ LLM se não
  reconhecer.

## Testes (herméticos)

- `vitest`, em `test/*.test.ts`. **Sem rede e sem `gh`**: use `ScriptedProvider`/stubs e
  `mkdtempSync` para workspaces temporários.
- Separe lógica pura testável (ex.: `frameLines()`, `buildPrdPrompt`, `clampDiff`) do IO.
- Rode `npm run typecheck && npm run build && npm test` antes do PR.

## context.md fresco

Se adicionou/removeu arquivo em `src/` ou mudou o comentário-cabeçalho, rode
`npm run context` (o CI falha em `git diff --exit-code context.md`).
