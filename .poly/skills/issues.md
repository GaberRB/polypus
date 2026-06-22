# skill: issues

Criar e triar issues no fluxo issue-gated do Polypus.

## Princípios

- Todo trabalho começa por uma **issue**. Templates: 🐛 bug e ✨ feature (issues em branco
  desativadas).
- A issue precisa receber a label **`accepted`** (decisão do mantenedor) antes de qualquer PR.
  **Você não aplica `accepted`** — peça ao usuário.
- Numeração de issues e PRs é **compartilhada** no GitHub (uma issue pode sair como #N e o
  PR seguinte como #N+1).

## Criar uma issue

Sempre via **`--body-file`** (markdown com crases quebra em here-string):

```bash
gh issue create --repo GaberRB/polypus --title "<titulo>" --label enhancement \
  --body-file /tmp/issue.md
```

### Preencha TODOS os campos do template — corretamente

Identifique o **tipo** e use o conjunto de campos certo. **Não deixe campo vazio, nem com
placeholder** (`<...>`, "N/A", "preencher"): ou preenche com conteúdo real e específico, ou
remove a issue. Toda string técnica (versão, caminho, comando, código) tem que ser **lida do
repositório**, nunca inventada — confira `package.json`, o código e a saída real antes.
Numa issue de bug, rode/observe o comportamento antes de descrever.

**🐛 Bug** — todos obrigatórios:
- **O que aconteceu** — descrição + por que é problema (motivação). Inclua o trecho/arquivo culpado quando souber.
- **Passos para reproduzir** — numerados, do zero ao sintoma.
- **Comportamento esperado** vs **atual** — explícito.
- **Versão do Polypus** — saída real de `polypus --version` (não chute).
- **Provider / modelo / SO** — ambiente real (ou "qualquer ambiente" se for bug de código puro).
- **Logs / saída** — cole a saída real (em bloco ```).
- **Confirmações** — checkboxes (procurou duplicata etc.).

**✨ Feature / enhancement** — todos obrigatórios:
- **Problema / motivação** — a dor concreta, para quem, por que agora.
- **Melhoria proposta + exemplos** — comportamento observável + exemplo de uso/CLI.
- **Alternativas consideradas** — e por que foram descartadas.
- **Confirmações** — checkboxes (duplicata; bilíngue se mexe em UI).

> Antes de submeter, releia: cada campo do tipo está preenchido com conteúdo **específico e
> verificado**? Se sim, cria. Issues fora do padrão (campos vazios/genéricos) atrapalham o
> PRD bot e a triagem.

Labels úteis: `enhancement`, `bug`, `documentation`. Crie a `accepted` uma vez se não
existir: `gh label create accepted --color 0e8a16` (mas **aplicar** é o usuário).

## PRD bot (automático)

Ao rotular uma issue com `accepted`, o workflow `prd-bot.yml` gera um **PRD estruturado** e
o posta como comentário na própria issue (modelo free do OpenRouter, lendo `context.md`).
Também roda manualmente: Actions → prd-bot → Run workflow (input = número da issue).

- O PRD é uma **primeira camada** (modelo grátis): use o julgamento. Implemente a intenção,
  não o PRD ao pé da letra. Partes genéricas/exageradas (ex.: "linting que falha o build se
  regra violada") podem ser substituídas pelo que é viável e útil.
- Ler o PRD: `gh issue view <n> --repo GaberRB/polypus --json comments` e filtrar o
  comentário do `github-actions`.

## Fechar issues

O `Closes #N` no corpo do PR **às vezes não fecha** a issue no squash-merge (inconsistência
observada). Confira depois do merge e feche manualmente se preciso:

```bash
gh issue close <n> --repo GaberRB/polypus --reason completed \
  --comment "Implementado no PR #<pr> e publicado na v<x.y.z>."
```
