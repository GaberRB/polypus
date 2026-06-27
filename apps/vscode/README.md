# Polypus — agentic AI chat para VSCode

Chat agêntico dentro do VSCode que roda com a **sua chave** e **modelos grátis/baratos**
(OpenRouter), usando engenharia (verify, plan-first, auto-contexto) para entregar qualidade
quase-frontier nas tarefas do dia a dia — **sem assinatura**.

O motor é o [CLI Polypus](https://github.com/GaberRB/polypus): a extensão é uma casca fina que
dá `spawn` em `polypus run --json --stream` e renderiza o stream NDJSON num painel de chat
nativo, com diffs inline e cards de escolha (`ask_user`).

## Recursos (MVP)

- Painel de chat na barra lateral, com tema nativo do VSCode (claro/escuro).
- Timeline de tool-calls + texto do agente em streaming.
- Diff inline para edições propostas.
- Cards de escolha interativos (`ask_user`) respondidos pelo painel.
- Cancelar execução, retomar sessão em follow-ups.
- Onboarding assistido da chave do OpenRouter (guardada no SecretStorage do VSCode).

## Desenvolvimento

A extensão faz parte do monorepo Polypus (npm workspaces).

```bash
# na raiz do repo
npm install
npm run build --workspace apps/vscode   # ou: npm run watch --workspace apps/vscode
```

Depois, no VSCode, abra a pasta `apps/vscode` e tecle **F5** (Run Extension) para abrir um
Extension Development Host com o painel "Polypus" na activity bar.

### Arquitetura

| Camada | Arquivo | Papel |
|--------|---------|-------|
| Host | `src/host/runBridge.ts` | spawn do CLI, parse NDJSON, stdin para `ask_user`, cancel |
| Host | `src/host/cli.ts` | resolve o CLI (setting → bundlado → global) |
| Host | `src/extension.ts` | WebviewViewProvider, SecretStorage, RPC de arquivos |
| Protocolo | `src/protocol.ts` | mensagens host ↔ webview |
| Webview | `src/webview/transport.ts` | `ChatTransport` sobre `postMessage` |
| UI | `@gaberrb/polypus-chat-ui` | reducer + componentes (compartilhados com o desktop) |

A lógica de UI (reducer stream→mensagens + componentes) vive em `packages/chat-ui` e é a **mesma**
consumida pelo app desktop — um único frontend para manter.

## Configuração

- `polypus.cliPath` — caminho para um CLI externo (vazio = usa o bundlado).
- `polypus.mode` — modo de permissão (`review` | `plan` | `bypass`).

## Status

Foundation funcional (chat, host, diffs, ask_user, onboarding). Pendente: empacotamento do CLI no
VSIX para publicação, exibição de preço/modelo, e publicação no Marketplace. Ver issue #185.
