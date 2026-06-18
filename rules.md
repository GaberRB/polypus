# rules.md — premissas e padrões do Polypus

> **Leitura obrigatória antes de qualquer PR** (humano ou agente de IA). Este arquivo é a
> fonte de verdade das convenções do projeto. Junto com [`context.md`](context.md) (o resumo
> do projeto), forma o contexto que orienta tanto contribuidores quanto os bots de PRD e de
> code review. Seguir o que está aqui é parte dos critérios de aceite.

## Premissas

- **Privacidade primeiro.** Nada sai da máquina além das chamadas aos provedores que o
  usuário configurou. Não adicione telemetria nem coleta de dados.
- **Funciona com qualquer modelo.** O harness precisa dirigir modelos com e sem
  function-calling (caminhos `native` e `emulated`). Não assuma que o modelo tem tools.
- **Bilíngue.** A interface é pt-BR (padrão) e en. Toda string visível ao usuário tem as
  duas traduções.
- **Enxuto.** Prefira a solução mais simples que resolve; evite dependências e abstração
  prematura.

## Stack e arquitetura

- **TypeScript + Node ≥ 20, ESM.** Build com `tsup`, testes com `vitest`, validação com `zod`.
- Imports relativos **sempre com extensão `.js`** (ESM), mesmo apontando para `.ts`.
- Camadas: `src/core` (lógica pura — agente, providers, tools, protocolo, config) e
  `src/cli` + `src/ui` (interface). O `core` não depende da CLI.
- Detalhes de cada módulo em [`context.md`](context.md).

## Padrões de codificação

- **Tools** implementam `{ ok: boolean; output: string }` e **nunca lançam** — capturam o
  erro e retornam `{ ok: false, output }`. Validam argumentos com `zod` antes de agir.
- **Providers** implementam a interface `Provider` e normalizam a resposta para
  `ChatResponse` (incluindo `finishReason` e `usage`).
- **i18n:** adicione cada chave nos **dois** catálogos (`en` e `pt-BR`) em
  `src/core/i18n/index.ts`. Não hardcode texto de UI.
- **Comentários** explicam o *porquê* (decisão, armadilha), não o óbvio. Densidade similar
  à do código ao redor. Em inglês, como o restante do código.
- **Nomes** descritivos; `snake_case` para nomes de tools expostos ao modelo, `camelCase`
  no TS.

## Testes

- Mudança de comportamento vem com teste em `test/*.test.ts` (`vitest`).
- Testes são **herméticos**: sem rede e sem `gh` — use provedores scriptados/stubs e
  workspaces temporários (`mkdtempSync`).
- Antes do PR, rode e garanta verde: `npm run typecheck`, `npm run build`, `npm test`.

## Esperado em uma contribuição

- Fluxo **issue-gated**: issue → label `accepted` → branch → PR com `Closes #N`.
- PRs pequenos e focados, com Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).
- Atualizar o `CHANGELOG.md` (seção `Unreleased`) quando o comportamento muda.
- Manter `context.md` em dia (`npm run context` regenera o mapa de módulos).

## NÃO esperado

- Telemetria, analytics ou qualquer envio de dados não solicitado.
- Dependências novas sem necessidade clara.
- Quebrar o caminho `emulated` (modelos sem tools precisam continuar funcionando).
- Strings de UI em um idioma só.
- PR sem issue `accepted` vinculada (o check `require-issue` bloqueia).
- Refator amplo misturado a uma correção/feature (separe em PRs).
