# skill: github-pages

Atualizar o site (GitHub Pages) em `docs/`. É **estático** (HTML/CSS/JS, sem build) e
publica sozinho ao mergear na `main`. URL: https://gaberrb.github.io/polypus/

## Estrutura

- `docs/index.html` — landing. Seções: hero, como funciona (diagrama de fluxo interativo),
  truque emulado, permissões, demo, features, quickstart, **contribuição**, changelog.
- `docs/cicd.html` — página dedicada de CI/CD (diagrama de pipeline interativo + YAML).
- `docs/fluxo.html` — simulador passo a passo tools vs sem-tools.
- `docs/styles.css` — design tokens (`--v0..--v5`, `--bg`, etc.) e classes reutilizáveis:
  `.section`, `.card`/`.cards.grid4`, `.flow`+`.node`+`.stage-detail` (diagrama interativo),
  `.steps`/`.step`, `.tabs`, `.codeblock`, `.deep`.
- `docs/app.js` — dicionário i18n (`I18N.pt`/`I18N.en`) + lógica dos diagramas.

## Bilíngue (obrigatório)

Todo texto visível usa `data-i18n="chave"` no HTML e a chave nos **dois** objetos
(`I18N.pt` e `I18N.en`) em `app.js`. Strings adicionais são anexadas via
`Object.assign(I18N.pt, {...})` / `Object.assign(I18N.en, {...})`.

## Diagrama interativo (padrão)

Reuse `.flow` com `<button class="node" data-cstage="x">` + um painel
`<div class="stage-detail" id="...Detail">` (`#...Title`/`#...Body`/`#...Code`). A lógica em
`app.js` é **guardada por presença de elemento** (`if (!document.getElementById(...)) return;`)
e re-renderiza no toggle de idioma. Espelhe `initCicd`/`initSimulator`.

## Links

Use **URLs absolutas** para arquivos do repo (ex.: `.../blob/main/CHANGELOG.md`) — o README
e o site são renderizados fora do GitHub (npm, Pages) e links relativos quebram.

## Validar antes do PR

```bash
node --check docs/app.js                       # sintaxe do JS
# toda chave data-i18n usada nos HTML existe no dicionário (PT e EN):
grep -ohrE 'data-i18n="[^"]+"' docs/*.html | sed -E 's/.*"([^"]+)".*/\1/' | sort -u
```
Abra `docs/index.html` no navegador para conferir visualmente (funciona local, sem servidor).
