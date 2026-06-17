# Contribuindo com o Polypus

Obrigado pelo interesse! Para manter o projeto saudável e o histórico limpo, seguimos um fluxo
simples baseado em **issues**. Leia antes de abrir um PR — PRs sem issue aceita **não passam no CI**.

_(English summary at the bottom.)_

## Fluxo de contribuição

1. **Abra uma issue** usando um dos templates (🐛 Bug ou ✨ Feature). Issues em branco estão
   desativadas — descreva **o problema, a motivação e exemplos**. Dúvidas/ideias abertas vão para
   [Discussions](https://github.com/GaberRB/polypus/discussions), não para o tracker.
2. **Aguarde a triagem.** O mantenedor revisa e, se fizer sentido, aplica a label **`accepted`**.
   Só então vale a pena abrir um PR. Isso evita trabalho jogado fora.
3. **Faça o fork** e crie uma branch curta com prefixo por tipo:
   - `feat/<slug>` · `fix/<slug>` · `docs/<slug>` · `chore/<slug>`
4. **Commits no padrão [Conventional Commits](https://www.conventionalcommits.org/):**
   `feat: …`, `fix: …`, `docs: …`, `chore: …`.
5. **Abra o PR** vinculando a issue no corpo: `Closes #123`. O check `require-issue` exige que a
   issue referenciada esteja `accepted`.
6. **CI verde + revisão.** O CI roda `typecheck`, `build` e testes (Node 20 e 22). O dono revisa e,
   se aprovado, faz **squash merge**.

> Resumindo: **issue → `accepted` → branch → PR vinculado → CI verde → merge do dono.**

## Rodando localmente

```bash
npm ci
npm run typecheck   # tsc --noEmit
npm run build       # tsup
npm test            # vitest
npm run dev         # build em watch
```

Antes de abrir o PR, garanta que `typecheck`, `build` e `test` passam — é exatamente o que o CI roda.

## Estilo

- TypeScript, Node ≥ 20, ESM.
- Mensagens de UI são bilíngues (pt-BR/en) via `src/core/i18n/` — adicione as duas.
- Mudanças de comportamento devem vir com testes (`test/*.test.ts`).

## O que evita PRs desnecessários

- Issues estruturadas e triadas (`accepted`) antes de qualquer código.
- O check `require-issue` bloqueia PRs sem issue aceita vinculada.
- Branch protection: ninguém faz merge sem aprovação do mantenedor.

---

## English (short)

Open a structured **issue** first (blank issues are disabled). Wait for the maintainer to label it
**`accepted`**. Then fork, branch (`feat|fix|docs|chore/<slug>`), use Conventional Commits, and open
a PR with `Closes #N`. The `require-issue` check enforces a linked **accepted** issue; CI runs
typecheck/build/test on Node 20 & 22; the owner squash-merges.
