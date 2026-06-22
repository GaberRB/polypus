# skill: release-npm

Cortar uma versão e publicar no npm. **Publish é automático** via `release.yml` ao
**publicar um GitHub Release** — o merge sozinho NÃO publica.

## Como o publish funciona (`release.yml`)

Dispara em `release: published`. Passos: valida que `package.json.version` == tag do
release → `npm run typecheck && npm test && npm run build` → `npm publish --provenance`
(usa o secret `NPM_TOKEN`). Logo: a versão do `package.json` na `main` precisa **bater com a
tag** antes de criar o release.

## SemVer

- Feature nova (comando, agente, capacidade) → **minor** (`0.x.0`).
- Só correção/doc → **patch** (`0.0.x`).
- Versão npm é **irreversível** (não republica a mesma) → **confirme o número com o usuário**.

## Passo a passo

1. Garanta que tudo que entra já está na `main` (mergeado).
2. Branch `release/<x.y.z>` da `main`. Bump em `package.json`.
3. CHANGELOG: insira `## [x.y.z] - <YYYY-MM-DD>` logo abaixo de `## [Unreleased]` (move o
   conteúdo de Unreleased pra versão); atualize os links de comparação no rodapé
   (`[Unreleased]: .../compare/v<x.y.z>...HEAD` e `[x.y.z]: .../compare/v<prev>...v<x.y.z>`).
4. Valide: `npm run typecheck && npm test` e, se aplicável, `git diff --exit-code context.md`.
5. PR `chore(release): v<x.y.z>` → merge na `main`.
6. Crie o Release (dispara o publish):
   ```bash
   gh release create v<x.y.z> --repo GaberRB/polypus --target main \
     --title "v<x.y.z>" --notes-file /tmp/rel.md
   ```
   Notas no formato: **Destaques** (bullets + #refs) · **Como atualizar**
   (`npm i -g @gaberrb/polypus@<x.y.z>`) · link pra seção do CHANGELOG.
7. Acompanhe o run e confirme:
   ```bash
   gh run list --repo GaberRB/polypus --workflow release.yml --limit 1 --json databaseId,status,conclusion
   npm view @gaberrb/polypus version    # deve mostrar a nova versão
   ```
8. Feche as issues incluídas se não fecharam sozinhas. Limpe branches locais.

## Reescrever notas de releases antigos (opcional)

`gh release edit v<x.y.z> --repo GaberRB/polypus --notes-file /tmp/notes.md` (ação pública
imediata — confirme antes).
