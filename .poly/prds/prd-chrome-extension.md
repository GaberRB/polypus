# PRD: Extensão Polypus para Chrome (Web Agent)

> **Status:** Rascunho · **Versão:** 0.1  
> **Inspiração:** Claude Web Agent (Computer Use), Vercel AI SDK browser tools  
> **Problema:** O Polypus hoje só age no sistema de arquivos local. A web é o maior playground de um agente — e está intocada.

---

## 1. Problema / Contexto

O Polypus hoje é um harness que age **dentro do seu projeto**: lê, escreve, edita arquivos e roda comandos. Mas um universo gigante de tarefas que um dev faz está **no navegador**: pesquisar, ler documentação, preencher formulários, testar deploys, criar issues, abrir PRs, postar em fóruns, administrar dashboards.

O **Claude Computer Use** e ferramentas similares mostraram que um agente que "vê" e "interage" com a web é um multiplicador de produtividade absurdo. Mas:
- Claude Computer Use é pago ($20/mês + taxa de uso), fechado, e só funciona com Anthropic
- Ferramentas como Browserbase/Playwright exigem infraestrutura
- Nenhuma alternativa open source faz isso com **qualquer modelo** (inclusive locais)

**A oportunidade:** O Polypus já tem o esqueleto — parser de tool calls, sistema de permissão, suporte multi-modelo. Adicionar um **domínio "web"** de tools (via extensão Chrome) transforma o Polypus num **agente que vive dentro do navegador**, onde o dev já passa 80% do tempo.

### O que o Claude Web Agent faz (referência)

O Claude (via Computer Use ou extensão) consegue:
- Navegar para URLs
- Clicar em botões, links, inputs
- Digitar texto em campos
- Extrair texto/elementos da página
- Rolagem e highlighting
- Interagir com modais e popups

**Diferença do Polypus:** O Polypus faria isso com **qualquer modelo** — não só Claude. E o usuário controla o custo (BYO-key). E é open source.

---

## 2. Objetivos & métricas de sucesso

**Objetivo:** Publicar uma extensão Chrome que permite ao Polypus agir na web, usando o motor de IA que o usuário já configurou (qualquer modelo, BYO-key).

**Métricas:**
- **M1** — Extensão publicada na Chrome Web Store (e Firefox, se viável)
- **M2** — ≥ 100 instalações ativas no primeiro mês
- **M3** — ≥ 60% das sessões completam pelo menos uma ação web com sucesso
- **M4** — Zero relatos de violação de segurança (injeção, acesso não autorizado)

---

## 3. Arquitetura proposta

```
┌──────────────────────────────────────────────────────────────────┐
│                     Navegador (Chrome)                            │
│                                                                   │
│  ┌────────────┐    ┌──────────────────────┐                      │
│  │  Popup UI   │    │  Content Script      │                      │
│  │  (controle  │◄──►│  (age na página:     │                      │
│  │   rápido)   │    │   clicar, ler,        │                     │
│  └──────┬──────┘    │   preencher, rolar)  │                      │
│         │           └──────────┬───────────┘                      │
│  ┌──────┴──────────────────────┴───────────────┐                 │
│  │         Service Worker (background)          │                 │
│  │  • Gerencia websocket com o Polypus CLI      │                 │
│  │  • Coordena ações entre content script e CLI │                 │
│  │  • Gerencia fila de ações e permissões       │                 │
│  └──────────────────────┬───────────────────────┘                 │
└─────────────────────────┼─────────────────────────────────────────┘
                          │ WebSocket / NDJSON (stdin/stdout)
┌─────────────────────────┴─────────────────────────────────────────┐
│                     Máquina Local                                   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Polypus CLI (processo filho)                                │   │
│  │  • Loop do agente (ReAct)                                    │   │
│  │  • Provider/modelo configurado pelo usuário                  │   │
│  │  • Tools: web + filesystem + comando                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Fluxo de uma ação web

1. Usuário ativa a extensão numa página (ex.: GitHub dashboard)
2. Abre o popup e digita: "crie uma issue descrevendo o bug no repositório X"
3. Extensão spawna (ou conecta a) `polypus run --json --stream --mode review` via Native Messaging ou WebSocket local
4. Agente decide que precisa navegar/navega/extrair/etc. → ferramentas web são chamadas via `chrome.scripting` + `chrome.tabs`
5. Cada ação web é aprovada pelo usuário (modo `review`)
6. Resultado volta pro loop do agente → próximo passo
7. Ao final, issue criada, resumo exibido

### Ferramentas web (novas tools)

Registradas em uma nova categoria `web`:

```
web.navigate(url)           → Navega para URL na aba ativa/nova aba
web.click(selector)         → Clica num elemento (css selector)
web.type(selector, text)    → Digita texto num input
web.extract(selector?)      → Extrai texto da página (ou de um elemento específico)
web.scroll(direction)       → Rola a página (up/down)
web.screenshot()            → Captura screenshot da viewport (base64)
web.getHtml()               → Obtém o HTML da página (para análise)
web.wait(ms)                → Aguarda carregamento
web.execute(jsCode)         → Executa JavaScript arbitrário (⚠️ modo bypass só)
```

### Modo de permissão específico para web

- `review` (default): cada ação web → popup de confirmação com preview do que vai fazer
- `plan`: só navega e extrai, nunca clica/digita
- `bypass`: executa automaticamente (perigoso — usar com URLs allow-list)
- **Allow-list de URLs**: o usuário pode configurar domínios que o agente pode acessar (ex.: `github.com/*`, `*.docs.io`)
- **Block-list de URLs**: domínios proibidos (ex.: bancos, e-mail)

---

## 4. Requisitos

### Funcionais

**RF1 — Popup de controle rápido**
- Botão "Ativar Polypus" na página atual
- Indicador de status (conectado/processando/erro)
- Input rápido de tarefa (inline)
- Botão para abrir painel dedicado (side panel)

**RF2 — Side panel dedicado** (Chrome Side Panel API)
- Chat com streaming das ações do agente
- Timeline visual: qual ação, em qual elemento, resultado
- Preview de ações pendentes (modo review): "Polypus quer clicar em 'New Issue' em github.com/... — permite?"
- Histórico de sessão

**RF3 — Tools web** (lista acima)

**RF4 — Conexão com o CLI Polypus**
- Via **Native Messaging** (extensão → binário nativo → CLI)
- Fallback: WebSocket local (`ws://localhost:PORTA`) se Native Messaging não disponível
- Detecta se o Polypus CLI está instalado e funcionando
- Se não estiver: onboarding que instala/guia o usuário

**RF5 — Modos de permissão**
- `review` / `plan` / `bypass` no contexto web
- Confirmações visuais no side panel
- Allow-list por domínio

**RF6 — Persistência de sessão**
- Sessão continua entre abas (o agente "segue" o usuário)
- Sessão continua com aba fechada (em background, com badge de notificação)

**RF7 — Screenshot como contexto visual**
- Para modelos com visão (GPT-4 Vision, Claude 3.5 Sonnet, Gemini, etc.): enviar screenshot da página como contexto visual
- Para modelos sem visão: extrair texto + elementos interativos identificáveis

**RF8 — Modo headless (sem UI)**
- Ações podem vir de outro processo (CLI `polypus web run "..."`)
- Útil para automação de CI/CD web (ex.: criar release no GitHub automaticamente)

### Não-funcionais

- **RNF1 — Privacidade:** nada sai da máquina além da chamada ao provedor de IA escolhido pelo usuário. A extensão não exfiltra dados.
- **RNF2 — Segurança:** o modo `review` mostra claramente "o agente vai clicar em X e digitar Y". O usuário aprova ou rejeita cada ação. O `bypass` exige confirmação extra (uma vez por sessão).
- **RNF3 — Permissões mínimas:** a extensão pede permissões específicas (`activeTab`, `scripting`, `storage`) — nunca `<all_urls>` sem justificativa.
- **RNF4 — Performance:** screenshots são comprimidos (JPEG 80%) antes de enviar pro modelo. A extração de texto é local.
- **RNF5 — Compatibilidade:** Chrome ≥ 110 (Side Panel API, Manifest V3). Firefox futuramente.
- **RNF6 — i18n:** pt-BR + en (como todo o Polypus).

---

## 5. O que o agente web pode fazer (casos de uso)

### 🔧 Para desenvolvedores (público-alvo principal)

| Tarefa | Exemplo | Como o Polypus ajuda |
|--------|---------|---------------------|
| **Criar/gerenciar issues** | "Abra uma issue no repositório X descrevendo o bug Y com os logs Z" | Navega, preenche título/corpo, submete |
| **Abrir PRs** | "Crie um PR do branch feat/x pra main com descrição baseada no diff" | Navega, clica em "Compare & pull request", preenche |
| **Preencher formulários de CI/CD** | "Faça o deploy no ambiente de staging" | Clica nos botões do GitHub Actions/CI |
| **Revisar PRs** | "Revise o PR #42 e deixe comments" | Lê diff, escreve comments inline |
| **Pesquisar documentação** | "Encontre como usar a API tal e adapte pro nosso código" | Navega docs, extrai, volta pro código |
| **Testar funcionalidades** | "Entre no admin panel, crie um usuário teste e verifique se aparece na listagem" | Preenche login, navega, preenche formulários |
| **Postar em discussions** | "Responda a discussion #5 com uma solução" | Lê, escreve resposta, posta |

### 🌐 Para usuários avançados (casos de uso gerais)

| Tarefa | Exemplo |
|--------|---------|
| **Automação de formulários** | "Preencha os 20 campos desse formulário com dados de teste" |
| **Web scraping inteligente** | "Extraia todos os preços dessa página de produtos e salve num CSV" |
| **Teste de regressão visual** | "Navegue por todas as páginas do site e tire screenshots" |
| **Moderação de conteúdo** | "Revise os últimos 50 comments e sinalize os que parecem spam" |
| **Preenchimento de relatórios** | "Acesse o dashboard e gere relatório mensal no formato X" |

---

## 6. Dependências & riscos

| # | Risco | Prob. | Impacto | Mitigação |
|---|-------|-------|---------|-----------|
| R1 | Chrome Web Store rejeita (política de permissões) | Média | Alto | Usar permissão mínima (`activeTab` + host_permissions por domínio); evitar `scripting` arbitrário no bypass |
| R2 | Native Messaging complexo de configurar | Alta | Médio | Priorizar WebSocket local (CLI já tem suporte a `--stream`); Native Messaging como fallback |
| R3 | Modelos sem function-calling não conseguem coordenar ações web complexas | Média | Alto | O protocolo emulado (XML) já funciona; ações web simples (navegar, extrair) são mais fáceis que editar código |
| R4 | Screenshot + contexto visual = muitos tokens | Alta | Médio | Screenshots JPEG comprimidos; modo "text-only" para modelos sem visão; usuário controla o modelo |
| R5 | Usuário não confia dar permissão de interagir com páginas | Alta | Alto | Modo `review` como default, com cada ação visível e aprovável; allow-list de domínios |
| R6 | Concorrência: extensões como Monica, Merlin, Claude | Alta | Médio | Diferencial: BYO-key, open source, qualquer modelo, sem assinatura |

---

## 7. Roadmap sugerido

### Fase 1 — MVP "Leitor Web" (2-3 semanas)

**Foco:** navegar + extrair conteúdo. O agente "vê" a web mas não interage.

- [ ] RF3 — Tools: `web.navigate`, `web.extract`, `web.scroll`, `web.wait`
- [ ] RF2 — Side panel com chat + timeline
- [ ] RF4 — Conexão WebSocket com CLI local
- [ ] RF8 — Suporte a screenshots (modelos com visão)
- [ ] Modo `plan` funcional (só leitura)

**Valor:** já dá pra "pesquise na documentação e resuma" ou "extraia dados dessa página".

### Fase 2 — Agente Interativo (2-3 semanas)

**Foco:** clicar, preencher, interagir.

- [ ] RF3 — Tools: `web.click`, `web.type`, `web.getHtml`
- [ ] RF1 — Popup de controle rápido
- [ ] RF5 — Modos de permissão com confirmação visual
- [ ] RF6 — Persistência de sessão entre abas

**Valor:** agente completo que navega e age na web.

### Fase 3 — Automação & Publicação (2 semanas)

- [ ] RF7 — Modo headless para CI/CD
- [ ] Publicação na Chrome Web Store
- [ ] Guia de uso e casos de exemplo
- [ ] Integração com `polypus run` (qualquer tarefa pode usar tools web)
- [ ] Port para Firefox (Manifest V3)

---

## 8. Questões em aberto

- **Q1** — A conexão com o CLI deve ser via WebSocket (CLI já existe e escuta) ou Native Messaging (mais seguro, mas complexo)?
- **Q2** — Screenshot como contexto visual: mandar a imagem pro modelo (caro) ou extrair elementos como structured data (barato)?
- **Q3** — O agente pode abrir **novas abas** ou só age na aba atual?
- **Q4** — Devemos permitir `web.execute(jsCode)` no modo `review`? (risco de segurança vs. utilidade)
- **Q5** — Precisa de servidor próprio (ex.: `polypus serve --ws`) ou o CLI já consegue fazer esse papel?
- **Q6** — Quando o agente web precisa de autenticação (login), como lidar sem expor credenciais?

---

> **Próximo passo:** Validar a arquitetura de conexão (Q1) e definir se o MVP começa com WebSocket ou Native Messaging.