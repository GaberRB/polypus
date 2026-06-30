# Handoff — Extensão Chrome (Polypus Web Agent)

**Data:** 28 de junho de 2026  
**Sessão iniciada por:** Gabriel Rios  
**Objetivo:** Melhorar documentação da extensão Chrome (troubleshooting, FAQ, advanced usage), adicionar strings i18n, criar script de empacotamento, preparar para submissão à Chrome Web Store.

---

## Sumário do que foi feito

### 1. Documentação do site (`docs/`)

#### `docs/app.js` — strings i18n adicionadas
Novas chaves nos catálogos `en` e `pt-BR`:

| Chave | Conteúdo |
|-------|----------|
| `chrome.trouble.action.*` | Troubleshooting: action buttons não respondem, página não carrega, conexão WebSocket cai, extensão não aparece |
| `chrome.faq.q1..a3` | FAQ: "Precisa de chave de API?", "Funciona no Firefox/Safari?", "Funciona com qualquer modelo?" |
| `chrome.advanced.*` | Seções de uso avançado: automação headless, comandos personalizados, debug |
| `chrome.use.*` (revisadas) | O que o agente pode fazer na web |

#### `docs/chrome.html` — seções adicionadas
- **Troubleshooting** — 4 problemas comuns com soluções (CSS selectors, página não carrega, WebSocket, extensão não aparece)
- **FAQ** — 3 perguntas frequentes
- **Advanced Usage** — 3 seções (headless automation, custom commands, debug mode)

### 2. Pipeline de build e empacotamento

#### `apps/chrome/zip.mjs` (NOVO — 66 linhas)
Script Node.js que gera `polypus-chrome.zip` para Chrome Web Store:
1. Cria diretório temporário
2. Copia `dist/` (manifest.json, icons, bundles JS)
3. Copia `popup/index.html` e `sidepanel/index.html`
4. Verifica presença de `manifest.json`
5. Gera ZIP via `powershell Compress-Archive`
6. Limpa diretório temporário (finally block)

#### `apps/chrome/package.json` — scripts atualizados
- `"build"` → `node esbuild.mjs` (já existia)
- `"package"` → build + copia manifest.json + icons para `dist/`
- `"package-zip"` → `npm run package && node zip.mjs`

Outros scripts mantidos: `typecheck`, `test`, `test:watch`, `lint`, `dev`.

### 3. Estrutura do ZIP validada

Saída de `npm run package-zip`:

```
polypus-chrome.zip (123.533 bytes, 11 arquivos)
├── manifest.json                   1.307 bytes
├── background.js                   2.098 bytes
├── content.js                      2.938 bytes
├── popup.js                      150.350 bytes
├── sidepanel.js                  158.990 bytes
├── popup/index.html                  483 bytes
├── sidepanel/index.html              496 bytes
└── icons/
    ├── 16.png                        240 bytes
    ├── 48.png                      1.070 bytes
    ├── 128.png                     4.328 bytes
    └── promo-440-280.png          14.613 bytes
```

Total descomprimido: ~337 KB  
Total comprimido: ~124 KB  

### 4. Guia de publicação

`apps/chrome/STORE.md` — guia detalhado para submeter à Chrome Web Store (já existia, foi mantido).

---

## Estado atual dos testes

### ❌ 3 testes falhando (pré-existentes, não causados pelas mudanças)

```
FAIL  test/swarm.test.ts — 1 test failed
  runSwarm > decomposes, runs workers in parallel worktrees, and merges cleanly
  → expected false to be true  (existsSync(join(ws, "fileA.txt")))

FAIL  test/swarm-reliability.test.ts — 2 tests failed
  swarm reliability > merges the workers that succeeded even when one fails
  → expected false to be true  (existsSync(join(ws, "fileA.txt")))

  swarm reliability > aborts a stalled worker on the idle timeout without hanging the run
  → expected false to be true  (existsSync(join(ws, "fileA.txt")))
```

**Sintoma comum:** `commitWorktree()` retorna `false` porque `git add -A` seguido de `git commit` reporta *"nothing to commit, working tree clean"* — os arquivos criados pelo worker não são detectados como mudanças.

**Causa provável:** O `write_file` tool escreve no `ctx.workspace` que é o caminho do worktree (`wt.path`). Porém, em worktrees no Windows, o `git status` pode não detectar arquivos novos por conta do `.git` link simbólico ou diferenças no comportamento do `simple-git` vs `execFileSync`. O error log mostra:

```
[commitWorktree] after-add status:
(empty — nenhuma saída de `git status --porcelain`)
```

**Debug realizado:** Um teste isolado (fora do worker) mostrou que `git init` + `git worktree add` + `echo hello > file` + `git add -A + commit` funciona. O problema parece estar no fluxo dentro do `runWorker()` — talvez o `write_file` esteja escrevendo no workspace errado, ou o worktree foi criado mas o arquivo vai parar no lugar errado.

---

## Pendências / O que falta

### 🔴 Prioridade alta

1. **Corrigir testes de swarm** (`test/swarm.test.ts`, `test/swarm-reliability.test.ts`)
   - Investigar por que `write_file` não produz mudanças detectáveis pelo git no worktree
   - Possível causa: `ctx.workspace` vs `wt.path` — o worker recebe o worktree `wt.path` como workspace, mas o conteúdo pode estar indo para outro lugar
   - Reproduzir com debug: rodar `commitWorktree` manualmente dentro do `guardedWorker` e verificar `readdirSync(wt.path)` antes de `git add`
   - Alternativa: o `write_file` no `worker.ts` pode estar usando `opts.workspace` (workspace original) em vez de `wt.path` (worktree isolado) — **confirmar no código**

2. **Upload para Chrome Web Store**
   - Pagar taxa única de US$ 5 (conta de desenvolvedor)
   - Fazer upload do `polypus-chrome.zip`
   - Preencher descrições, justificativa de permissões, política de privacidade
   - Incluir screenshots (popup + side panel em ação)

### 🟡 Prioridade média

3. **Aviso de `eval` no content script**
   - `esbuild` warning: `Using direct eval with a bundler is not recommended`
   - Local: `src/content/index.ts:133`
   - Necessário para `execute()` que roda código JS arbitrário na página
   - Aceitável para funcionamento, mas documentar no manifesto (não é "remote code")

4. **Ícones profissionais**
   - Ícones atuais são placeholders (PNGs convertidos de SVG simples)
   - Ideal: criar arte profissional com diagrama do polvo/agente

### 🟢 Baixa prioridade

5. **Testes específicos da extensão Chrome**
   - Não existem testes ainda para os módulos da extensão
   - `npm test` só roda os testes do core (swarm, agent, tools, etc.)
   - Ideal: testes unitários para `apps/chrome/src/`

---

## Comandos úteis

```bash
# Build + ZIP completo
cd apps/chrome
npm run package-zip

# Só build
npm run build

# Verificar estrutura do ZIP
python -c "import zipfile; z=zipfile.ZipFile('polypus-chrome.zip','r'); [print(f.filename) for f in z.infolist()]"

# Rodar testes
npm test
```

---

## Arquivos modificados/criados nesta sessão

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `docs/app.js` | Modificado | +30 chaves i18n (troubleshooting, FAQ, advanced) |
| `docs/chrome.html` | Modificado | +3 seções (troubleshooting, FAQ, advanced guides) |
| `apps/chrome/package.json` | Modificado | Script `package-zip` simplificado |
| `apps/chrome/zip.mjs` | Criado | Node.js ZIP bundler (66 linhas) |
| `apps/chrome/polypus-chrome.zip` | Criado | ZIP final (123 KB, 11 arquivos) |
| `handoff-chrome-28-06-2026.md` | Criado | Este documento |