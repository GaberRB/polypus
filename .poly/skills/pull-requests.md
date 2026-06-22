# skill: pull-requests

Abrir, validar e mergear PRs — com as armadilhas reais deste repo.

## Antes de abrir

1. Branch a partir da `main` atualizada: `feat|fix|docs|chore/<n>-<slug>`.
2. Implemente + testes. Garanta verde:
   `npm run typecheck && npm run build && npm test` (+ `npm run context` se mexeu em `src/`).
3. Atualize o `CHANGELOG.md` (seção `Unreleased`).

## Abrir o PR

Corpo via **`--body-file`** (markdown/`Closes #N`/links quebram em here-string):

```bash
gh pr create --repo GaberRB/polypus --base main --head <branch> \
  --title "feat(...): ... (#<n>)" --body-file /tmp/pr.md
```

- O corpo **deve** conter `Closes #<n>` (uma issue com `accepted`).
- O check **`require-issue`** exige issue `accepted` vinculada — **bypass para `GaberRB`** e
  `dependabot[bot]`, então PRs do dono passam mesmo assim, mas mantenha o `Closes #N`.

## ⚠️ Armadilha do PR empilhado (orphan)

Se um PR-B depende de um PR-A (stacked, base = branch do A) e você **mergeia os dois quase
juntos**, o GitHub não retargeta o B a tempo → o B é mergeado **na branch do A** (que já foi
pra main) e as mudanças do B ficam **órfãs** (não chegam à main), e o `Closes` não dispara.

**Como evitar:**
- Prefira **não empilhar**: branch sempre da `main`.
- Se precisar empilhar, **mergeie o A, espere o GitHub retargetar o B para `main`**, e só
  então mergeie o B.
- **Conserto** se acontecer: cherry-pick do commit órfão sobre a `main` num PR novo
  (`git checkout -b fix/... origin/main; git cherry-pick <sha>`).

## Integrar duas features que tocam o mesmo arquivo

CHANGELOG e arquivos auto-gerados (`context.md`) costumam conflitar. Resolva mergeando a
`main` na branch, **mantendo as duas entradas** do CHANGELOG, e rode `npm run context` pra
o mapa de módulos incluir os arquivos novos das duas features (senão o check de drift do CI
falha na main).

## Mergear

```bash
gh pr merge <n> --repo GaberRB/polypus --squash --delete-branch
```

Depois: confira se a issue fechou (senão feche manual — ver `issues.md`) e sincronize:
`git checkout main; git fetch origin --prune; git reset --hard origin/main`.

## Review automático

Ao abrir/reabrir o PR, o `pr-review.yml` comenta um review. Avalie antes de mergear — ver
[`review-triage.md`](review-triage.md).
