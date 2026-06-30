# Tasks — Extensão Chrome Polypus Web Agent

> **PRD de referência:** `prd-chrome-extension.md`  
> **Escopo desta rodada:** Fase 1 — MVP "Leitor Web" (navegar + extrair, sem interação)  
> **Local do código:** `apps/chrome/`  
> **Branch:** `feat/chrome-extension-mvp`

---

## 📊 Resumo Financeiro (estimativa)

| Total Cost (USD) | Total Tokens (est.) | Modelo Default |
| :--- | :--- | :--- |
| **$0.30** | ~22,000 | `openai/gpt-oss-120b:free` |

---

## 📋 Tasks

> As tarefas abaixo foram desacopladas para execução paralela — cada uma cria arquivos em diretórios diferentes dentro de `apps/chrome/`, sem conflito de estado entre si.

### Task 01: Scaffold da extensão Chrome (Manifest V3 + estrutura de diretórios)

**Descrição:** Criar a estrutura inicial da extensão Chrome em `apps/chrome/` com Manifest V3, seguindo o mesmo padrão das outras apps (`apps/desktop/`, `apps/vscode/`).

**Arquivos a criar:**
- `apps/chrome/manifest.json` — Manifest V3 com:
  - `manifest_version: 3`
  - `name: "Polypus Web Agent"`
  - `version: "0.1.0"`
  - `description` bilíngue
  - `permissions: ["activeTab", "scripting", "storage", "sidePanel"]`
  - `host_permissions: ["http://localhost/*"]` (para WebSocket com CLI)
  - `background.service_worker: "dist/background.js"`
  - `side_panel.default_path: "sidepanel/index.html"`
  - `action.default_popup: "popup/index.html"`
  - `icons` (reusar assets do Polypus)
- `apps/chrome/package.json` — nome `@gaberrb/polypus-chrome`, scripts `dev`/`build`/`typecheck`/`package`
- `apps/chrome/tsconfig.json` — target ES2022, strict, paths
- `apps/chrome/esbuild.mjs` — build script que gera:
  - `dist/background.js` (service worker)
  - `dist/content.js` (content script)
  - `sidepanel/` (copiado do source)
  - `popup/` (copiado do source)
- `apps/chrome/.gitignore`
- `apps/chrome/icons/` — ícones 16, 48, 128 (SVG/PNG do mascote)

**Critério de aceite:** `npm run build` em `apps/chrome/` produz extensão carregável no Chrome (`chrome://extensions` — Load unpacked) com o popup vazio funcional.

**Arquivos:** `apps/chrome/manifest.json`, `package.json`, `tsconfig.json`, `esbuild.mjs`, `.gitignore`, `icons/*`

---

### Task 02: Popup UI — controle rápido (React + JSX)

**Descrição:** Interface do popup que aparece ao clicar no ícone da extensão. Deve ser um React app simples (bundlado com esbuild) que mostra:
- Botão "Ativar Polypus" na página atual
- Indicador de status (conectado/processando/erro) com bolinha colorida
- Input de tarefa inline (textarea pequeno)
- Botão "Enviar" + "Abrir painel dedicado"
- Ícone do mascote Polypus
- i18n básica (pt-BR + en, mesma estrutura do `docs/app.js`)

**Arquivos a criar:**
- `apps/chrome/src/popup/index.html` — HTML mínimo com React root
- `apps/chrome/src/popup/main.tsx` — Entry point React
- `apps/chrome/src/popup/App.tsx` — Componente principal com:
  - `StatusIndicator` (bolinha verde/amarela/vermelha)
  - `TaskInput` (textarea + botão enviar)
  - `PolypusMascot` (SVG inline do mascote, reusado do desktop)
- `apps/chrome/src/shared/i18n.ts` — Dicionário pt-BR/en nos mesmos moldes de `docs/app.js`
- `apps/chrome/src/shared/types.ts` — Tipos compartilhados (status, eventos)

**Integração:** O popup se comunica com o service worker via `chrome.runtime.sendMessage()`.

**Critério de aceite:** Popup abre, mostra o mascote, o input de tarefa permite digitar, o indicador de status reage a mensagens do background.

**Arquivos:** `apps/chrome/src/popup/*`, `apps/chrome/src/shared/*`

---

### Task 03: Side Panel — chat com timeline e streaming

**Descrição:** O side panel (Chrome Side Panel API) é o coração da UI — um chat completo com streaming das ações do agente, timeline de ferramentas web e preview de ações pendentes.

**Arquivos a criar:**
- `apps/chrome/src/sidepanel/index.html`
- `apps/chrome/src/sidepanel/main.tsx`
- `apps/chrome/src/sidepanel/App.tsx` — Componente principal
- `apps/chrome/src/sidepanel/ChatView.tsx` — Mensagens do agente com streaming de texto
- `apps/chrome/src/sidepanel/Timeline.tsx` — Timeline visual de ações web:
  - Ícone por tipo de ação (🌐 navigate, 👆 click, ⌨️ type, 📄 extract)
  - Status (pending → running → done/error)
  - Elemento alvo (ex.: "button#new-issue")
  - Duração
- `apps/chrome/src/sidepanel/ConfirmCard.tsx` — Card de confirmação (modo review):
  - "Polypus quer: [ação] em [elemento] na página [url]"
  - Botões Aprovar/Rejeitar (estilo `ConfirmCard.tsx` do `packages/chat-ui`)
- `apps/chrome/src/sidepanel/UsageBar.tsx` — Barra de tokens/custo

**Estilo:** Tema escuro com cores do Polypus (roxo `#7A4ADE`), usando variáveis CSS. Design responsivo.

**Integração:** Recebe eventos do service worker via `chrome.runtime.onMessage`. Envia comandos (run, stop, respond) via mensagens.

**Critério de aceite:** Side panel abre com Ctrl+B (ou ícone), mostra chat vazio com placeholder, aceita mensagens e renderiza timeline de ferramentas.

**Arquivos:** `apps/chrome/src/sidepanel/*`

---

### Task 04: Service Worker (background) — WebSocket client + gerenciamento de sessão

**Descrição:** O service worker (background) é o cérebro da extensão — gerencia a conexão WebSocket com o CLI Polypus, coordena ações entre popup/side-panel e content script, e mantém o estado da sessão.

**Arquivos a criar:**
- `apps/chrome/src/background/index.ts` — Entry point do service worker com:
  - **WebSocket Client:** conecta em `ws://localhost:PORTA` (configurável, default 9876), reconecta com backoff exponencial
  - **Protocolo NDJSON:** envia tarefas como `{ type: "run", task: "..." }`, recebe eventos `StreamEvent` (mesmo formato do `runBridge.ts`)
  - **Router de mensagens:** `chrome.runtime.onMessage` dispatches entre popup, side panel e content script
  - **Estado da sessão:** sessão ativa, histórico de ações, permissões pendentes
  - **Badge:** atualiza badge da extensão com status (🐙 / ✓ / ✗)
  - **Detecção do CLI:** ao iniciar, tenta conectar; se falhar, abre onboarding
  - **Onboarding:** se CLI não estiver rodando, exibe instruções (via popup) de como iniciar: `npx @gaberrb/polypus web-server`

**Eventos recebidos do WebSocket (do CLI):**
```typescript
type StreamEvent = 
  | { type: "start" }
  | { type: "assistant_delta"; text: string }
  | { type: "tool_call"; tool: string; args: Record<string, unknown>; id: string }
  | { type: "tool_result"; tool: string; ok: boolean; output: string; id: string }
  | { type: "ask_user"; id: number; question: string; options: string[] }
  | { type: "confirm_request"; id: number; action: string; target?: string }
  | { type: "usage"; tokensIn: number; tokensOut: number; costUsd: number }
  | { type: "error"; message: string }
  | { type: "end"; code?: number }
```

**Eventos enviados pro WebSocket:**
```typescript
type WsCommand = 
  | { type: "run"; task: string; mode: "plan" | "review" | "bypass" }
  | { type: "stop" }
  | { type: "respond_ask"; id: number; selected: string[] | null }
  | { type: "respond_confirm"; id: number; approved: boolean }
```

**Critério de aceite:** Service worker conecta ao WebSocket, recebe eventos, repassa pra UI, e envia comandos de volta.

**Arquivos:** `apps/chrome/src/background/*`

---

### Task 05: Content Script — ferramentas web (injetado na página)

**Descrição:** Script injetado na página que executa as ações web reais: navegar, extrair texto, rolar, screenshot. Expõe funções via `window.__polypus` para o service worker chamar.

**Arquivos a criar:**
- `apps/chrome/src/content/index.ts` — Content script que expõe:

```typescript
// API exposta para o service worker (chrome.runtime.sendMessage)
interface WebActions {
  navigate(url: string): Promise<{ ok: boolean; title: string; url: string }>;
  extract(selector?: string): Promise<{ ok: boolean; text: string }>;
  scroll(direction: "up" | "down" | "top" | "bottom"): Promise<{ ok: boolean }>;
  screenshot(): Promise<{ ok: boolean; dataUrl: string }>;  // JPEG 80%
  getHtml(): Promise<{ ok: boolean; html: string }>;
  wait(ms: number): Promise<{ ok: boolean }>;
}
```

**Detalhes de implementação:**
- `navigate`: `window.location.href = url; await waitForPageLoad()`
- `extract`: `document.querySelector(selector)?.innerText` ou `document.body.innerText`
- `scroll`: `window.scrollBy({ top: -500 })` etc.
- `screenshot`: usa `canvas` + `document.documentElement` ou pede pro background capturar via `chrome.tabs.captureVisibleTab()` (que requer permissão `activeTab` mas é mais confiável)
- `getHtml`: `document.documentElement.outerHTML`
- `wait`: `new Promise(r => setTimeout(r, ms))`

**Comunicação:** Content script escuta mensagens do background via `chrome.runtime.onMessage`. Executa a ação e retorna o resultado.

**Segurança:** O content script só é injetado via `chrome.scripting.executeScript` quando o background solicita (não é auto-executável em todas as páginas).

**Critério de aceite:** Content script injetado na página ativa responde a comandos `navigate`, `extract`, `scroll`, `screenshot` com resultados corretos.

**Arquivos:** `apps/chrome/src/content/*`

---

### Task 06: WebSocket Server no CLI (`polypus web-server`)

**Descrição:** Novo subcomando no CLI do Polypus que inicia um servidor WebSocket, permitindo que a extensão Chrome se conecte. Baseado no mesmo motor do `polypus run --json --stream`, mas escutando conexões externas.

**Arquivos a modificar:**
- `src/cli/commands/web-server.ts` — Novo arquivo:
  ```typescript
  export async function webServerCommand(port: number, allowOrigin?: string): Promise<void>
  ```
  - Inicia servidor WebSocket na porta especificada (default 9876)
  - Aceita conexões e gerencia múltiplas sessões
  - Para cada mensagem `{ type: "run", task, mode }`, spawna o loop do agente (reusando `src/core/agent/loop.ts`) e emite eventos NDJSON como mensagens WebSocket
  - Suporta `stop`, `respond_ask`, `respond_confirm`
  - Loga no terminal: conexões, tarefas, erros
  - Flag `--port` e `--allow-origin`

- `src/cli/index.ts` — Registrar comando:
  ```typescript
  program.command("web-server")
    .description("Start a WebSocket server for the Chrome extension")
    .option("-p, --port <number>", "WebSocket port", "9876")
    .option("--allow-origin <url>", "Allowed CORS origin", "chrome-extension://*")
    .action(webServerCommand);
  ```

- `src/core/i18n/index.ts` — Adicionar chaves:
  - `cli.cmd.webServer`: "Start a WebSocket server for the Chrome extension"
  - `cli.arg.wsPort`: "WebSocket port"
  - `webServer.listening`: "WebSocket server listening on ws://localhost:{port}"
  - `webServer.clientConnected`: "Client connected: {addr}"
  - `webServer.clientDisconnected`: "Client disconnected"
  - `webServer.running`: "Task running: {task}"

**Dependências:** Usar `ws` (WebSocket) ou `node:http` + implementação WebSocket nativa (Node 22+ tem suporte experimental). Avaliar qual opção.

**Critério de aceite:** `polypus web-server --port 9876` inicia, aceita conexão WebSocket, recebe tarefa e transmite eventos NDJSON.

**Arquivos:** `src/cli/commands/web-server.ts`, modificações em `src/cli/index.ts` e `src/core/i18n/index.ts`

---

### Task 07: Screenshot como contexto visual (otimização de tokens)

**Descrição:** Implementar o pipeline de screenshot otimizado para modelos com e sem visão.

**Arquivos a criar:**
- `apps/chrome/src/content/screenshot.ts` — Captura e compressão:
  - Usa `chrome.tabs.captureVisibleTab()` (fornecido pelo background) para capturar a viewport como dataUrl
  - Comprime para JPEG qualidade 80% via canvas
  - Redimensiona para max 1280px de largura
  - Retorna `{ dataUrl: string, width: number, height: number }`

- `apps/chrome/src/shared/vision-optimizer.ts` — Lógica de otimização:
  - Se modelo SEM visão: extrai texto + elementos interativos (links, buttons, inputs) como structured data JSON
  - Se modelo COM visão: envia screenshot comprimido + marcadores de elementos interativos
  - Detecta se o modelo atual tem suporte a visão pela config do agente

**Integração:** O service worker, ao receber uma ação que precisa de contexto visual, decide qual estratégia usar baseado no modelo ativo e anexa ao prompt do agente.

**Critério de aceite:** Screenshot é capturado, comprimido (< 100KB) e enviado como contexto. Modo text-only extrai elementos da página sem screenshot.

**Arquivos:** `apps/chrome/src/content/screenshot.ts`, `apps/chrome/src/shared/vision-optimizer.ts`

---

### Task 08: Modo "plan" funcional (leitura-only) + sistema de permissão

**Descrição:** Implementar o modo `plan` (só navega + extrai, nunca modifica) e o sistema básico de permissão.

**Arquivos a criar/modificar:**
- `apps/chrome/src/shared/permissions.ts`:
  ```typescript
  interface WebPermissions {
    mode: "plan" | "review" | "bypass";
    allowList: string[];   // domínios permitidos (ex.: ["github.com/*"])
    blockList: string[];   // domínios bloqueados (ex.: ["bank.com/*"])
  }
  ```
  - `isUrlAllowed(url, permissions): boolean`
  - `isActionAllowed(action, mode): boolean` — plan bloqueia click/type/execute

- `apps/chrome/src/sidepanel/PermissionBar.tsx` — UI de permissão:
  - Seletor de modo (Plan / Review / Bypass) com ícones
  - Input de allow-list por domínio
  - Preview do que o agente pode fazer no modo atual
  - Persistência via `chrome.storage.sync`

**Modo plan:**
- Ferramentas liberadas: `navigate`, `extract`, `scroll`, `screenshot`, `getHtml`, `wait`
- Ferramentas bloqueadas: `click`, `type`, `execute`
- O agente é informado no system prompt que está em modo plan e não pode modificar nada

**Critério de aceite:** Em modo `plan`, as únicas ações executadas são de leitura. Tentativas de click/type são rejeitadas com mensagem clara.

**Arquivos:** `apps/chrome/src/shared/permissions.ts`, `apps/chrome/src/sidepanel/PermissionBar.tsx`

---

### Task 09: Página inicial da extensão no site (`docs/chrome.html`)

**Descrição:** Página dedicada no site do Polypus para promover a extensão Chrome.

**Arquivo a criar:**
- `docs/chrome.html` — Landing page da extensão (estilo `docs/vscode.html`):
  - Hero: "Polypus Web Agent — seu agente no navegador"
  - Diagrama de arquitetura (similar ao fluxo do `index.html`)
  - Passo a passo de instalação:
    1. Instale o CLI: `npm i -g @gaberrb/polypus`
    2. Inicie o servidor: `polypus web-server`
    3. Instale a extensão (link Chrome Web Store)
    4. Conecte e use
  - Casos de uso com prints/gifs
  - Badge "Disponível para Chrome"
  - i18n pt-BR + en (atualizar `app.js`)

**Inclusão no header do site:**
- Adicionar link "Extensão Chrome" no nav de `docs/index.html` e `docs/cicd.html`

**Critério de aceite:** Página carrega, explica a extensão, tem i18n, e tem link pra Chrome Web Store (placeholder enquanto não publica).

**Arquivos:** `docs/chrome.html`, modificações em `docs/index.html` e `docs/app.js`

---

### Task 10: Polypus web tools no core (registro de ferramentas web)

**Descrição:** Registrar as ferramentas web no core do Polypus para que o agente possa chamá-las via protocolo nativo ou emulado. Essas ferramentas são **pontes** — quando chamadas, o agente emite um evento pro WebSocket, a extensão executa no navegador, e o resultado volta.

**Arquivo a criar:**
- `src/core/tools/web.ts` — Implementação das tools web:

```typescript
export const webNavigate: Tool = {
  spec: {
    name: "web_navigate",
    description: "Navigate the browser to a URL. The extension will open it in the current tab.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to navigate to (must be https/http)" },
      },
      required: ["url"],
    },
  },
  mutating: false,  // só leitura
  async run(args, ctx) {
    // Em modo headless (sem extensão): usar fetch pra simular navegação
    // Em modo extensão: emitir evento WebSocket
    ...
  },
};
```

**Tools a registrar:**
- `web_navigate(url)` — Navegar para URL
- `web_extract(selector?)` — Extrair texto da página
- `web_scroll(direction)` — Rolar página
- `web_screenshot()` — Capturar screenshot
- `web_get_html()` — Obter HTML completo
- `web_wait(ms)` — Aguardar
- `web_click(selector)` — Clicar em elemento
- `web_type(selector, text)` — Digitar em input
- `web_execute(js)` — Executar JS (⚠️ só bypass)

**Registro:** Adicionar em `src/core/tools/registry.ts`

**Modo headless (sem extensão):** Quando não há extensão conectada, as tools web usam fetch + regex como fallback limitado (só leitura).

**Critério de aceite:** Ferramentas web são registradas, aparecem no `toolSpecs()`, e funcionam em modo emulado e nativo.

**Arquivos:** `src/core/tools/web.ts`, modificação em `src/core/tools/registry.ts`

---

## 🔗 Dependências entre tasks

```
Task 01 (scaffold) ─── base pra todas
    ├── Task 02 (popup) ─── depende de 01
    ├── Task 03 (sidepanel) ─── depende de 01
    ├── Task 04 (background WS) ─── depende de 01, 06
    ├── Task 05 (content script) ─── depende de 01
    ├── Task 06 (CLI web-server) ─── independente (core)
    ├── Task 07 (screenshot) ─── depende de 05
    ├── Task 08 (permissions) ─── depende de 03, 04
    ├── Task 09 (site page) ─── independente (docs)
    └── Task 10 (core tools) ─── independente (core)
```

**Paralelizáveis:** Tasks 06 (core) e 09 (docs) podem rodar em paralelo com todas as outras.

---

## 🏁 Checkpoint de integração

Depois que todas as tasks da Fase 1 estiverem implementadas:

1. Rodar `npm run build` em `apps/chrome/` — deve gerar extensão completa
2. Rodar `polypus web-server --port 9876` — servidor WebSocket ativo
3. Carregar extensão no Chrome (`chrome://extensions` — Load unpacked apontando `apps/chrome/`)
4. Testar fluxo: abrir página → clicar extensão → digitar tarefa → ver agente navegar + extrair
5. Verificar modo `plan` (não permite clique/type) e `review` (pede confirmação)
6. Rodar `npm run typecheck && npm run build && npm test` no core (não pode quebrar nada)
7. Atualizar `CHANGELOG.md` com as mudanças

---

> **Próximo passo:** Criar branch `feat/chrome-extension-mvp` e começar pela Task 01 (scaffold) + Task 06 (CLI web-server) que são independentes e destravam as demais.