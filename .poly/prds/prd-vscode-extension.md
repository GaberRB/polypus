# PRD: Extensão Polypus para VSCode

> Status: rascunho · Origem: grill-me + create-prd (2026-06-26) · Dono: GaberRB

## 1. Problema / Contexto

O Polypus standalone (CLI completo + app desktop Electron) tem pouca distribuição. O público-alvo
— devs — já vive dentro do VSCode, onde Copilot, Claude Code, Continue e Cline disputam o mesmo
espaço. O CLI Polypus já emite um protocolo NDJSON estruturado e testado (consumido hoje pelo app
desktop), então o motor está pronto; falta a **vitrine** onde o público está. A oportunidade é
entrar como um **chat agêntico nativo do VSCode** que roda com a chave do próprio usuário e modelos
grátis/baratos (OpenRouter), entregando qualidade quase-frontier via engenharia (harness:
verify, plan-first, auto-contexto, parser, finish-gate) — sem assinatura.

## 2. Objetivo & métrica de sucesso

Publicar uma extensão no VSCode Marketplace que reusa o motor (CLI) existente e dá um chat
agêntico nativo. **Sucesso não é "estar no Marketplace" — é instalação → ativação → retenção.**

Métricas observáveis:
- **Ativação:** ≥ 60% das instalações completam a 1ª run com sucesso (passaram do onboarding da chave).
- **Retenção:** usuários ativos semanais (WAU) / instalações ≥ 25% após 4 semanas.
- **Fracasso:** instala e desinstala sem 1ª run bem-sucedida (onboarding ou rate-limit mataram).

## 3. Usuários & cenários

**Persona principal:** dev que já usa VSCode, quer assistência de IA agêntica mas não quer (ou não
pode) pagar Copilot/Claude — tem uma chave OpenRouter (ou topa criar uma) e quer rodar modelos
grátis/baratos com qualidade decente.

**Caminho feliz:** instala a extensão → abre o painel lateral "Polypus" → onboarding pede a chave
OpenRouter (com deep-link pra criar) → cola a chave → digita uma tarefa no chat → vê a timeline de
tool-calls e o texto do agente em streaming → quando o agente propõe edição, vê o **diff inline** e
aprova/rejeita → quando o agente precisa decidir, responde um **card de escolha** (ask_user) → run
termina com resumo e custo/tokens.

**Edge cases relevantes:**
- Rate-limit do modelo grátis no meio da run → mensagem clara + sugestão de cair pro modo `fast` ou trocar de modelo.
- Sem chave configurada → composer bloqueado com CTA de onboarding (não erro críptico).
- Run cancelada pelo usuário (botão stop) → mata o processo filho limpo.
- Pasta/workspace não aberto → estado vazio explicando que precisa de um projeto aberto.
- CLI bundlado falha ao iniciar (Node/permissão) → erro acionável, não silêncio.

## 4. Requisitos

### Funcionais (o que o sistema FAZ)

- **RF1** — Registrar um painel de chat na barra lateral do VSCode (webview própria, com ícone), arrastável para sidebar/panel/aba.
- **RF2** — Ao enviar uma tarefa, dar `spawn` no CLI bundlado com `run --json --stream --mode <m>` no diretório do workspace ativo, e fazer streaming dos eventos NDJSON para a webview (reusa a lógica de `bridge.ts:423-486`).
- **RF3** — Renderizar a timeline de execução em tempo real: `assistant_delta` (texto streaming), `tool_call`/`tool_result` (com ícone/status), `usage` (tokens/custo). Reusa o reducer puro de `Chat.tsx:104-163`.
- **RF4** — Renderizar edições propostas como **diff inline com aprovar/rejeitar** (per-hunk quando aplicável), respeitando o modo de permissão.
- **RF5** — Renderizar `ask_user` como **card de escolha** clicável; a resposta volta pelo **stdin** do processo filho (`{type:"ask_response",...}`), desbloqueando o agente.
- **RF6** — Botão de **cancelar** que mata o processo filho (SIGTERM) e encerra a run.
- **RF7** — Persistir/retomar a sessão entre mensagens via `session_start`/`--resume` (follow-ups no mesmo chat continuam a conversa).
- **RF8** — **Onboarding assistido da chave**: detectar ausência de chave OpenRouter, oferecer deep-link para criar, capturar e salvar de forma segura (VSCode SecretStorage), e refletir no estado do composer.
- **RF9** — Bundlar o CLI `@gaberrb/polypus` dentro do VSIX e executá-lo via Node do VSCode (sem exigir `polypus` global nem `node` externo); permitir override por setting (`polypus.cliPath`).
- **RF10** — Extrair `packages/chat-ui` (monorepo) com o reducer + componentes puros (timeline, DiffViewer, ChoiceCard, UsageBar) injetando uma interface de `transport`; desktop e extensão consomem o mesmo pacote.
- **RF11** — Selecionar/exibir o modelo/agente ativo e permitir alternar (no mínimo ler do config do Polypus; ideal: trocar pelo painel).

### Não-funcionais (como ele se comporta)

- **RNF1 — Aparência nativa:** a webview usa **tokens de tema do VSCode** (`var(--vscode-*)`), seguindo tema claro/escuro do usuário. Não pode parecer um app Electron custom.
- **RNF2 — Independência:** não depende do GitHub Copilot Chat instalado (webview própria, **não** a Chat Participant API).
- **RNF3 — Segurança:** chave em SecretStorage (nunca em settings.json em texto puro); CSP estrita na webview; sem `nonce`-less inline scripts.
- **RNF4 — Resiliência a rate-limit:** detectar erro de rate-limit no stream e degradar/avisar (sugerir `fast` ou troca de modelo) em vez de travar mudo.
- **RNF5 — Não-regressão:** zero mudança no caminho humano/TTY do CLI; a extensão só consome o modo `--json --stream` já existente.
- **RNF6 — i18n:** strings da UI localizáveis (pt-BR + en), alinhado ao i18n existente.
- **RNF7 — Performance:** parsing incremental do stdout por linha; UI não trava com runs longas (virtualização se necessário).

## 5. Fora de escopo (explícito)

- Painel de **settings próprio** — usar as Settings do VSCode (`contributes.configuration`).
- **File tree / explorer** próprio — usar o Explorer nativo do VSCode.
- **Painel MCP** próprio — gerenciamento de MCP fica via `.poly/mcp.json` (o CLI já carrega).
- **Mascote** e demais elementos visuais do desktop.
- Modo **terminal-integrado** estilo Claude Code (a aposta é chat-em-painel, estilo Copilot/Continue).
- Reescrever o motor (loop do agente, providers, tools) — tudo permanece no CLI.
- Marketplace de modelos pagos próprios / billing — BYO-key OpenRouter no MVP.

## 6. Dependências & riscos

**Dependências:**
- CLI `@gaberrb/polypus` publicado/empacotável e estável no contrato NDJSON (`json-output.ts`).
- API de Webview + SecretStorage do VSCode.
- Conta de publisher no VSCode Marketplace.
- Refactor de extração `packages/chat-ui` (desacoplar `window.polypus` → `transport`).

**Riscos & mitigação:**
- **R1 — Rate-limit do tier grátis trava a UX** (maior risco de retenção). → Detectar e degradar pro modo `fast` / avisar trocar de modelo (RNF4).
- **R2 — Overpromessa "igual ao Claude"** gera churn. → Posicionamento honesto: "qualidade quase-frontier nas tarefas do dia a dia, grátis pra começar".
- **R3 — Atrito de onboarding da chave** derruba instalação. → Onboarding deep-link assistido (RF8).
- **R4 — Terceiro frontend pra manter** (TTY, desktop, extensão). → `packages/chat-ui` compartilhado (RF10).
- **R5 — CLI bundlado falha em ambientes Node restritos.** → Override `polypus.cliPath` (RF9) + erro acionável.
- **R6 — Tamanho do VSIX** com CLI bundlado. → Medir; usar bundler/tree-shaking; aceitar trade-off pelo onboarding liso.

## 7. Critérios de aceite (testáveis)

- [ ] **CA1** — Dado um workspace aberto e chave configurada, quando o usuário envia uma tarefa, então a timeline de tool-calls e o texto do agente aparecem em streaming no painel.
- [ ] **CA2** — Dado um agente propondo edição de arquivo, quando o evento chega, então um diff inline com botões aprovar/rejeitar é exibido e a escolha é aplicada/descartada.
- [ ] **CA3** — Dado um `ask_user` no stream, quando o card é exibido e o usuário escolhe, então a resposta é escrita no stdin do filho e o agente continua.
- [ ] **CA4** — Dado uma run em andamento, quando o usuário clica em cancelar, então o processo filho é morto e a UI volta ao estado ocioso.
- [ ] **CA5** — Dado follow-ups no mesmo chat, quando uma 2ª mensagem é enviada, então a sessão é retomada via `--resume` (contexto preservado).
- [ ] **CA6** — Dado nenhuma chave configurada, quando o painel abre, então o onboarding assistido aparece (com deep-link) e o composer fica bloqueado até a chave ser salva no SecretStorage.
- [ ] **CA7** — Dado o tema do VSCode alterado (claro↔escuro), quando o painel re-renderiza, então as cores seguem os tokens `--vscode-*`.
- [ ] **CA8** — Dado o VSIX instalado em máquina sem `polypus` global nem `node` no PATH, quando uma tarefa roda, então o CLI bundlado executa via Node do VSCode com sucesso.
- [ ] **CA9** — Dado um erro de rate-limit durante a run, quando o evento chega, então o usuário vê uma mensagem acionável (degradar/trocar de modelo), não um travamento silencioso.
- [ ] **CA10** — Dado o pacote `packages/chat-ui`, quando o app desktop e a extensão são buildados, então ambos importam o mesmo reducer/componentes (sem duplicação do código de timeline).

## 8. Questões em aberto

- **Q1** — Nome da extensão e publisher no Marketplace; o pitch "modelos grátis" entra no título? (decide: GaberRB)
- **Q2** — Troca de modelo/agente acontece no painel (UI nova) ou só lê do config existente no MVP? (decide: GaberRB)
- **Q3** — Modos de permissão expostos na UI (review/plan/bypass) ou fixo em `review` no v1? (decide: GaberRB)
- **Q4** — Estratégia de telemetria de ativação/retenção respeitando privacidade (opt-in?) — necessária pras métricas da seção 2. (decide: GaberRB)
- **Q5** — Suporte a outros providers além de OpenRouter no v1, ou OpenRouter-only? (decide: GaberRB)
