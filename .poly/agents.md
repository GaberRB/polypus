# agents.md — como um agente de IA opera o Polypus

> Workspace **local** e **gitignored** (`.poly/`). Não é commitado. Serve para condicionar
> qualquer agente de IA (Claude, etc.) a trabalhar neste repositório do jeito certo,
> reproduzindo o fluxo já validado. **Fonte de verdade do projeto:** [`../context.md`](../context.md)
> (resumo) e [`../rules.md`](../rules.md) (padrões). Leia os dois antes de codar.

## Papel

Você é um agente que implementa mudanças no Polypus de ponta a ponta: da **issue** ao
**PR**, passando pelo **CI + review automático**, **merge**, **publish no npm** e
**atualização do site**. Sempre respeitando a governança issue-gated e os padrões do
`rules.md`.

## Regras de ouro (não negociáveis)

1. **Issue-gated.** Nenhum PR sem uma issue com a label `accepted`. Fluxo:
   `issue → accepted → branch → PR (Closes #N) → CI verde → merge`.
2. **Nunca rotule issues você mesmo** (`accepted`) — é decisão do mantenedor (GaberRB) e o
   classificador bloqueia. Peça para o usuário aplicar.
3. **Bilíngue sempre.** Toda string de UI vai nos dois catálogos (`en` e `pt-BR`) em
   `src/core/i18n/index.ts`.
4. **Verde antes do PR.** `npm run typecheck && npm run build && npm test` (+ `npm run context`
   se mexeu na estrutura de `src/`).
5. **CHANGELOG** atualizado (seção `Unreleased`) a cada mudança de comportamento.
6. **Confirme antes de ações externas** difíceis de desfazer (publish npm, editar release,
   fechar issue de terceiros). Versão npm **não** se republica.
7. **Modelo free confiável:** `openai/gpt-oss-120b:free` (verificado rápido/estável). Evite
   `llama-3.3-70b:free` (429) e `qwen3-coder:free` (lento) como default.

## Ciclo de vida de uma tarefa

```
issue → (PRD bot ao rotular accepted) → branch feat|fix|docs/<n>-<slug>
      → implementar + testes → PR (Closes #N) → CI + pr-review bot
      → avaliar review → merge (squash) → fechar issue (manual, ver skill)
      → [release] bump + CHANGELOG + GitHub Release → release.yml publica no npm
      → [se docs] site em docs/ atualiza no merge
```

## Índice de skills

| Skill | Quando usar |
|-------|-------------|
| [`skills/issues.md`](skills/issues.md) | Criar/triar issues; como o PRD bot funciona |
| [`skills/pull-requests.md`](skills/pull-requests.md) | Branch, PR, require-issue, merge, **armadilha do PR empilhado**, auto-close |
| [`skills/review-triage.md`](skills/review-triage.md) | Ler e avaliar o review bot; separar falso positivo |
| [`skills/release-npm.md`](skills/release-npm.md) | Versionar, CHANGELOG, GitHub Release → publish no npm |
| [`skills/github-pages.md`](skills/github-pages.md) | Atualizar o site (`docs/`): i18n, diagramas interativos |
| [`skills/coding.md`](skills/coding.md) | Padrões técnicos: tool nova, comando, i18n, testes, providers |
| [`skills/task-generation.md`](skills/task-generation.md) | Quebrar PRD em tarefas paralelizáveis e documentar no PR |

## Ambiente

- **Windows + PowerShell** (sem `&&`/`||`; use `;` ou o Bash tool). `gh` em
  `C:\Program Files\GitHub CLI\gh.exe`.
- Para passar corpo de PR/issue/release com markdown, use **`--body-file`** (here-strings
  quebram com crases/links). Atenção a **BOM** ao ler JSON vindo de pipe do PowerShell.
- `gh` autenticado como **GaberRB** (ADMIN). `OPENROUTER_API_KEY` e `NPM_TOKEN` já são
  secrets do repo.
