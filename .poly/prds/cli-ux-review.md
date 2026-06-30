# Review de squad — PR #150 + excelência de CLI/UX do Polypus

> Workspace local (`.poly/`, gitignored). Não é issue nem PR. Backlog priorizado para o mantenedor
> transformar em issues `accepted` quando quiser. Data: 2026-06-25.
>
> **Squad:** PM (valor/escopo) · QA (correção/cobertura) · Dev (segurança/robustez) ·
> Especialista em I.A (ergonomia de tooling de agente, caminho `emulated`).

---

## 1. Veredito do PR #150 (Closes #149)

**Atende à intenção da issue #149** (tool Python para extrair valores de arquivos estruturados), mas a
implementação original tinha defeitos bloqueantes. **Reescrito e corrigido** nesta sessão (commit na branch
`polypus/issue-149`):

| Problema original | Status |
|---|---|
| Command injection (`python -c "…"` escapando só `"`) | ✅ Eliminado — script via **stdin** (`python3 -`), sem shell |
| `mutating:false` + sem `authorizeCommand` (furava plan/review/bypass) | ✅ `mutating:true` + gate por `authorizeCommand` |
| Sem timeout / sem clamp de saída | ✅ 120s + clamp 20k (espelha `run-command.ts`) |
| `input` declarado e nunca usado | ✅ Removido |
| `Decision` duplicado em `tools/types.ts` | ✅ Removido (usa o único de `permissions/modes.ts`) |
| Teste em `src/**/__tests__` → **nunca rodava no CI** + lógica errada | ✅ Movido p/ `test/`, reescrito, hermético |
| Typo "complexod" no CHANGELOG | ✅ Corrigido |
| Chaves i18n `run_python_script.*` mortas | ✅ Removidas (consistente com `run_command`) |
| Armadilha Windows: alias `python3` do Store | ✅ Sonda `--version` antes de usar |

PR pronto para o mantenedor mergear (merge auto-publica **v0.4.37** no npm). CI Linux deve passar; as únicas
falhas locais são testes de **swarm** (worktrees git reais) — flake de ambiente Windows, pré-existente e sem
relação com a mudança.

---

## 2. Backlog priorizado de CLI/UX (não implementado — proposta)

Critério: **impacto no usuário × esforço**. Cada item tem proposta + critério de aceite testável. UX no
terminal é UX de verdade: hierarquia, feedback, microcopy e acessibilidade contam mesmo sem GUI.

### 🔴 Alto impacto

**P1 — `--quiet` / `--no-color` como flags de primeira classe**
- *Problema:* hoje só dá pra silenciar via `--json` (que muda todo o output) e cores só via env `NO_COLOR`.
  Quem usa o Polypus em script/pipe não tem um modo "silencioso legível".
- *Impacto:* automação e logs poluídos por spinner/ANSI; fricção pra integrar em CI fora do `--json`.
- *Proposta:* `--quiet` (suprime spinner/banner/status, mantém resultado e erros) e `--no-color` (alias de
  `NO_COLOR=1`), resolvidos em `src/cli/index.ts`, espelhando a precedência de `--lang`.
- *Aceite:* `polypus run --quiet "x"` não emite frames de spinner nem banner; `--no-color` zera ANSI mesmo em
  TTY; ambos documentados no `--help` e i18n nos dois catálogos.

**P2 — Mensagem de erro acionável quando falta chave/Python/binário**
- *Problema:* erros de pré-requisito (sem agente, sem API key, sem Python para `run_python_script`) chegam
  como texto cru. Ex.: a nova tool retorna "Python not found" só ao modelo, não ao usuário.
- *Impacto:* usuário novo trava sem saber o próximo passo (a "primeira corrida" é o momento mais frágil).
- *Proposta:* padronizar erros de pré-requisito com **causa + próximo comando** (ex.: "rode `polypus setup`",
  "instale Python 3 e tente de novo"), via uma helper de erro em `cli-io.ts`, i18n nos dois catálogos.
- *Aceite:* rodar sem agente configurado, sem key, e disparar a tool Python sem interpretador → cada caso
  mostra uma frase de causa + ação concreta; coberto por teste de unidade da helper.

**P3 — Sessões legíveis (título + data) em vez de só UUID**
- *Problema:* `polypus sessions` / `/resume` listam UUIDs; navegar é tentativa e erro.
- *Impacto:* continuidade de trabalho (feature forte do produto) fica difícil de usar.
- *Proposta:* derivar um título da 1ª mensagem (truncado) + timestamp relativo ("há 2h"); manter o id como
  sufixo curto. Em `src/cli/commands/sessions.ts` + `session-store.ts`.
- *Aceite:* a listagem mostra `título · há Xh · agente · #mensagens · <id-curto>`; `/resume <id-curto>`
  resolve por prefixo único.

### 🟡 Médio impacto

**P4 — `/help` explica os modos de permissão (plan/review/bypass)**
- *Problema:* o `/help` lista comandos mas não explica o que cada modo faz; só o wizard explica.
- *Proposta:* uma linha por modo no `/help` e no `--help` do `run` (microcopy i18n). Em `src/ui/repl.ts` +
  catálogo.
- *Aceite:* `/help` mostra "plan = só leitura · review = confirma cada ação · bypass = aprova tudo".

**P5 — Aliases curtos para `add-agent`**
- *Problema:* `add-agent --provider --model --api-key --base-url --tool-mode` é verboso, sem `-p/-m`.
- *Proposta:* aliases `-p/--provider`, `-m/--model`, `-k/--api-key`, `-u/--base-url` em
  `src/cli/commands/add-agent.ts` (commander suporta nativamente).
- *Aceite:* `polypus add-agent or -p openrouter -m anthropic/claude-3.5-sonnet` funciona idêntico à forma longa.

**P6 — Símbolos de status com fallback ASCII**
- *Problema:* ✓ ✗ ⚠ ■ 🐙 são hardcoded; terminais pobres/Windows legados e leitores de tela degradam.
- *Proposta:* um pequeno mapa de glifos com fallback ASCII (`[ok]`, `[x]`, `!`) quando `NO_COLOR`/não-TTY ou
  uma flag `POLYPUS_ASCII`. Centralizar em `src/ui/` (ex.: ao lado de `banner.ts`).
- *Aceite:* com `POLYPUS_ASCII=1` nenhuma saída usa Unicode decorativo; testado em `test/`.

**P7 — Erro de tool amigável no modo interativo**
- *Problema:* falha de tool (ex.: `run_command`/`run_python_script` com exit≠0) volta crua ao usuário no REPL.
- *Proposta:* no caminho interativo, formatar falhas de tool com rótulo + 1ª linha do erro + dica, mantendo o
  texto completo pro modelo (autocorreção). Em `src/cli/commands/run.ts`.
- *Aceite:* uma tool que falha mostra um bloco compacto e legível, sem despejar stack trace inteiro no terminal.

### 🟢 Baixo impacto / polimento

**P8 — Hierarquia visual consistente (tabela vs lista)**
- Padronizar `agents`/`sessions`/`models`/`usage` num mesmo estilo de tabela alinhada. UX-design: reduzir
  carga cognitiva por consistência.

**P9 — Instruções claras em conflito de merge do swarm**
- Quando um branch de worker conflita, imprimir o caminho do worktree + o comando exato pra resolver.

**P10 — Feedback no carregamento de `.env` e no fetch de modelos**
- `loadDotenv()` é silencioso (ok), mas um `--verbose` poderia confirmar "carreguei N chaves de ~/.polypus/.env";
  fetch do OpenRouter poderia mostrar contagem/ETA.

---

## 3. Ergonomia de tooling de agente (lente de I.A)

Itens específicos de "ferramenta de I.A" que afetam a qualidade do agente, não só a UX humana:

- **Description da `run_python_script`** foi escrita para o modelo decidir *quando* usá-la ("prefira
  `read_file` para texto puro; use isto quando parsear à mão for frágil") — reduz uso indevido. ✅ feito.
- **Mensagens de erro como sinal de autocorreção:** a tool preserva exit code + stderr no output, que alimenta
  `correction.ts`. Manter esse padrão em qualquer tool nova (não engolir o stderr). ✅ feito.
- **Caminho `emulated`:** a tool entra no `toolSpecs()` e é documentada no system prompt automaticamente; o
  `script` é um único arg string, fácil de emitir no protocolo XML por modelos sem function-calling. ✅ ok.
- *Sugestão futura (issue):* um teste de regressão garantindo que toda tool em `registry.ts` tenha
  `spec.description` não-vazia e `parameters.required` coerente — barra tools mal-especificadas que confundem
  modelos fracos.

---

## 4. Como agir

Nada aqui foi aberto como issue (decisão do mantenedor). Sugestão de ordem: **P1, P2, P3** primeiro (maior
retorno de UX por esforço), cada um como issue pequena e focada com os critérios de aceite acima → label
`accepted` → branch → PR, seguindo o fluxo issue-gated do `rules.md`.
