# Polypus Cowork (desktop)

Desktop app for **Polypus Cowork** — coworking with Polypus agents in a clear,
visual UI. Built with **Electron + React + Vite + TypeScript**.

> Scaffold only (issue #113). This is the runnable shell; real screens land in the
> follow-up issues (chat/execução #115, aprovação #116, sidebar #117, onboarding
> #118, …). See the epic #112.

## Estrutura

```
apps/desktop/
  electron.vite.config.ts   # builds main + preload + renderer
  src/
    main/index.ts           # Electron main process (creates the window)
    preload/index.ts        # contextBridge → window.polypus (typed)
    renderer/               # React app (the UI)
      index.html
      src/{main.tsx,App.tsx,styles.css}
```

The app is a **standalone package** (`@gaberrb/polypus-cowork`) and does not touch
the root `package.json`. It will reuse the existing `src/core` logic over IPC
(bridge lands in #114), starting from the headless JSON paths
(`run/review/estimate --json`).

## Desenvolvimento

```bash
cd apps/desktop
npm install
npm run dev        # launches Electron with HMR
```

## Build

```bash
npm run build      # type-checks + bundles main/preload/renderer into out/
npm run preview    # preview the production build
```

## Ponte core↔UI (#114)

O renderer fala com o core via `window.polypus` (preload, `contextIsolation`). A v1
da ponte reusa os comandos **headless JSON**: o processo main spawna o CLI do
Polypus e devolve o JSON parseado. Operações: `estimate`, `review`, `run`.

- Aponte o CLI com `POLYPUS_CLI` (ex.: `POLYPUS_CLI=../../dist/index.js`) para rodar
  via Node; sem isso, usa `polypus` no PATH.
- Toda chamada resolve para um `Result<T>` (`{ ok, data } | { ok:false, error }`),
  então o renderer nunca vê exceção.
- Streaming de tokens ao vivo e as demais superfícies (agents, sessions, usage,
  retrieval) chegam quando `src/core` for consumido como biblioteca.

## Notas

- `contextIsolation` ligado; o renderer só fala com o main via o bridge tipado em
  `src/preload`.
- Empacotamento (instaladores mac/win/linux via electron-builder) será adicionado
  em uma issue de distribuição.
