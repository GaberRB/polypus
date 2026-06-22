# skill: review-triage

Ler e **avaliar** o comentário do review bot (`pr-review.yml`) antes de mergear.

## Contexto

O review é gerado por um **modelo gratuito** do OpenRouter (primeira camada, não substitui
revisão humana). Ele lê o `rules.md`/`context.md` como contexto. É útil, mas tem o perfil
clássico de modelo free: **acerta alguns pontos reais e mistura falsos positivos**.

## Como ler

```bash
gh pr view <n> --repo GaberRB/polypus --json comments  # filtre o comentário "Review autom"
```
Se ainda não apareceu, o run está rodando (~1-2 min):
```bash
gh run list --repo GaberRB/polypus --workflow pr-review.yml --limit 1 --json databaseId,status,conclusion
gh run view <id> --repo GaberRB/polypus --json status,conclusion   # poll até completed
```

## Avaliar (sempre explique o motivo)

Para **cada** apontamento, confronte com o código real antes de aceitar:

1. **Guardas já existentes?** Falsos positivos comuns: "falta limite de repetição" quando já
   existe `failStreak`/`maxToolRetries`/`maxReprompts`/`maxSteps`; "pode ser `undefined`"
   quando o tipo é obrigatório e sempre populado; "`finally` roda mesmo se criar falhar"
   quando a criação está **antes** do `try`.
2. **Já é intencional/por design?** Ex.: mensagem de sucesso em `stderr` (mantém `stdout`
   limpo p/ pipe); troca de modelo default documentada; `--input` ignorar metadados.
3. **Over-engineering?** Campo novo numa interface central, refator amplo, trocar deps por
   ganho marginal → recusar num fix.
4. **Vale mesmo:** validação de input com mensagem clara, guards baratos, testes de caminhos
   não cobertos, links absolutos no README (renderiza no npm/site), pequenas melhorias de
   clareza.

## Saída

Classifique em **Vale / Falso positivo (com o porquê) / Opcional**, dê o veredito, e
**pergunte** se aplica os que valem (no mesmo PR, se ainda aberto). Não aplique nada sem o
ok do usuário quando ele pediu só a avaliação.
