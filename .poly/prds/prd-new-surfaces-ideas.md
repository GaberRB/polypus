# PRD: Polypus — Novas Superfícies de Uso (Brainstorming)

> **Status:** Rascunho / Brainstorming · **Versão:** 0.1  
> **Problema:** Polypus hoje tem 3 superfícies (CLI, VSCode, Desktop Electron) e 10 usuários.  
> **Objetivo:** Mapear **todas** as formas possíveis de distribuir o motor do Polypus em lugares onde devs já vivem.

---

## 1. Matriz de Superfícies

Classificação por **esforço de implementação** (do mais fácil ao mais difícil) e **alcance potencial**.

```
ALTO ALCANCE
    │
    │   🟢 GitHub App      🟡 Discord Bot     🟡 JetBrains Plugin
    │   🟢 GitHub Action   🟡 Neovim Plugin    🔴 Obsidian Plugin
    │   🟢 Chrome Ext      🟡 Telegram Bot     🔴 TUI rica
    │   🟢 API Server      🟡 MCP Server       🔴 SSH Daemon
    │
    │   🟢 = baixo esforço  🟡 = médio  🔴 = alto
    └───────────────────────────────────────────────►
    FÁCIL                              DIFÍCIL
```

---

## 2. Superfícies Completas (para implementar)

### 2.1 🟢 **GitHub App (polypus-bot)**

**O que é:** Um GitHub App que você instala nos seus repositórios. O Polypus vira um "membro do time" que comenta, revisa e age via issues/PRs.

**Problema que resolve:** Hoje o Polypus age no sistema de arquivos local. Mas muito do trabalho de um dev open source acontece **dentro do GitHub**: triar issues, revisar PRs, manter CI/CD.

**Como funciona:**

| Funcionalidade | Descrição |
|----------------|-----------|
| **Auto-triage de issues** | Quando uma issue é criada, o bot classifica (bug/feature/question), sugere labels e pergunta pontos faltando |
| **Code review assistido** | Em PRs abertos, pode revisar o diff e deixar comments com sugestões (além do pr-review.yml atual) |
| **Auto-resposta em Discussions** | Perguntas frequentes geram resposta automática |
| **Auto-close de stale issues** | Com mais critério que o workflow atual (entende contexto) |
| **Merge automático condicional** | "Quando CI passar E review aprovar E tests passarem, faça squash merge" |

**Exemplo de interação:**

```
Usuário abre issue #42: "O servidor cai quando passa payload muito grande"
↓
polypus-bot comenta: "Parece ser um bug de limite de payload. 
Você pode confirmar: 1) qual versão do Node? 2) tem logs? 
3) é HTTP ou HTTPS? Enquanto isso, [aqui](/fix/limit-payload) 
um branch com correção proposta."
↓
(Se o mantenedor autorizar, o bot já abre um PR com a correção)
```

**Integração com o Polypus local:** O GitHub App pode acionar um webhook que o usuário hospeda (ou rodar via GitHub Actions — que já existe no `agent.yml`).

**Público:** Mantenedores de projetos open source (é o SEU público!). Um dev que mantém 5 repositórios não tem tempo pra triar tudo.

**Esforço:** Baixo — reusa `agent.yml` + API do GitHub (octokit). O principal é o webhook handler.

---

### 2.2 🟢 **GitHub Action reutilizável**

**O que é:** Uma `action.yml` que outros repositórios podem usar nos seus workflows:

```yaml
- uses: GaberRB/polypus/.github/actions/polypus-agent@v1
  with:
    task: "Review this PR and leave comments"
    openrouter-key: ${{ secrets.OPENROUTER_API_KEY }}
    model: "gpt-4o-mini"
```

**Problema que resolve:** Qualquer repositório quer um code review automático, auto-PR, ou auto-fix. Hoje cada um precisa configurar seu próprio agente.

**Casos de uso:**
- `auto-review`: revisa PR automaticamente (concorre com CodeRabbit, Bito, etc.)
- `auto-fix`: quando CI falha, o agente tenta corrigir e abre um commit
- `auto-docs`: gera/atualiza documentação a cada merge na main
- `auto-changelog`: gera changelog a partir de commits convencionais

**Diferencial competitivo:** A ação é gratuita, open source, e roda com a chave do próprio usuário (sem taxa de serviço).

**Esforço:** Muito baixo — encapsular o `agent.yml` atual como uma action.

---

### 2.3 🟡 **Discord Bot**

**O que é:** Um bot do Discord que você convida pro seu servidor. O Polypus age via chat.

**Problema que resolve:** Times de desenvolvimento já vivem no Discord. Poder pedir pro agente "me explica esse erro" ou "cria um PR pra corrigir o bug X" sem sair do Discord é produtividade pura.

**Funcionalidades:**

- Canal dedicado `#polypus` onde você manda tarefas
- O bot responde com o streaming das ações
- Pode ser configurado por repositório (via slash commands: `/polypus connect repo`)
- `/polypus run "cria um PR pra arrumar o bug #42"` 
- `/polypus status` — mostra o que está rodando
- `/polypus explain "qual a causa desse erro?"` — cola um erro e pede análise
- Notificações: "PR #43 aberto com a correção do bug #42"

**Público:** Times de desenvolvimento, comunidades open source no Discord.

**Arquitetura:** Bot em Node.js (discord.js) que consome o CLI via `child_process` + `--json --stream`.

**Esforço:** Médio — o core já existe, mas precisa de um processo servidor contínuo.

---

### 2.4 🟡 **Neovim / Vim Plugin**

**O que é:** Um plugin nativo para Neovim (Lua) que permite interagir com o Polypus sem sair do editor.

**Problema que resolve:** Uma parcela enorme de devs (especialmente os que mais gostam de open source) vive no Neovim. O VSCode é mainstream, mas o Neovim é o coração da comunidade open source raiz.

**Funcionalidades:**

| Comando | Descrição |
|---------|-----------|
| `:PolypusRun "tarefa"` | Roda uma tarefa e mostra resultado num buffer flutuante |
| `:PolypusExplain` | Explica o código selecionado (visual mode) |
| `:PolypusFix` | Tenta corrigir erro do compilador/linter na linha atual |
| `:PolypusReview` | Revisa o diff do staged/unstaged |
| `:PolypusChat` | Abre uma janela flutuante de chat inline (como Copilot Chat no VSCode) |
| `:PolypusCommit` | Gera mensagem de commit a partir do diff |

**Diferencial:** Neovim tem suporte nativo a LSP, então dá pra integrar o diagnóstico do LSP com o Polypus (`:PolypusFix` lê o diagnostic do LSP e tenta corrigir).

**Público:** Devs Neovim (nicho = ~15% dos devs, mas são formadores de opinião).

**Esforço:** Médio — plugin Lua puro, comunicação via `vim.fn.jobstart` com o CLI.

---

### 2.5 🟡 **JetBrains Plugin (IntelliJ, WebStorm, GoLand, PyCharm)**

**O que é:** Plugin para o ecossistema JetBrains, que domina o mercado de IDEs pagas (Java, Kotlin, Go, Python).

**Problema que resolve:** O JetBrains tem 30%+ do mercado de IDEs, e o público paga por ferramentas. Não ter presença lá é deixar dinheiro (e usuários) na mesa.

**Funcionalidades:** Similar ao VSCode: painel de chat com agente, diff inline, aprovação de edições.

**Diferencial:** Plugin Kotlin + IntelliJ Platform SDK. O Polypus seria **o único agente open source** com suporte nativo a JetBrains.

**Esforço:** Alto — outro ecossistema, outra linguagem (Kotlin/Java), outro SDK. Mas o reuso do CLI via processo filho é o mesmo padrão.

---

### 2.6 🟡 **API Server (REST + WebSocket)**

**O que é:** Um servidor HTTP que expõe o motor do Polypus como API. `polypus serve --port 3000`.

**Problema que resolve:** Integração com outras ferramentas. Um dev quer chamar o Polypus de dentro de um script Python, um workflow do n8n, um bot do Telegram, ou uma extensão do Obsidian.

**Endpoints:**

```
POST /run             → Executa uma tarefa (stream via WebSocket ou SSE)
GET /sessions         → Lista sessões ativas
POST /sessions/:id    → Continua uma sessão
GET /models           → Lista modelos/config disponíveis
GET /health           → Health check
```

**Casos de uso:**
- Integração com n8n/Make/Zapier (automação low-code)
- Bot do Telegram chama a API
- Script de CI chama a API antes do deploy
- Plugin Obsidian chama a API

**Esforço:** Baixo-médio — CLI já faz o core, só falta o servidor HTTP.

---

### 2.7 🟢 **MCP Server (Model Context Protocol)**

**O que é:** O Polypus se expõe como um **servidor MCP** para outras ferramentas de IA (Claude Desktop, Cline, Continue, etc.).

**Problema que resolve:** Outras IAs não têm acesso ao sistema de arquivos com segurança. O Polypus já tem todo o sistema de permissão (plan/review/bypass, allow-list, deny-list). Ao expor como MCP, **qualquer** agente pode usar o Polypus como "braço" seguro.

**Funcionalidades (tools MCP):**

```
polypus__read_file(path)
polypus__write_file(path, content)
polypus__edit_file(path, search, replace)
polypus__run_command(command)
polypus__list_dir(path)
polypus__search(query, glob)
polypus__finish(summary)
```

**Exemplo de uso:** O Claude Desktop pede "edite o arquivo tal" → em vez de dar permissão genérica, o Polypus gerencia com allow-list e modos.

**Diferencial:** O Polypus é o único MCP server que já tem modo `plan` (só leitura) e `review` (confirma cada ação). É um **gateway de segurança** para qualquer agente.

**Esforço:** Muito baixo — já existe `src/core/mcp/client.ts`, só falta o server. Usar `@modelcontextprotocol/sdk`.

---

## 3. Superfícies Experimentais (ideias verdes)

### 3.1 🔵 **Terminal UI (TUI) Rica**

**O que é:** Uma interface TUI tipo `htop`/`lazygit` para o Polypus — com painéis, timeline visual, gráficos de tokens, e aprovação de ações com teclas.

```
┌─────────────────────────────────────────────────────┐
│ 🐙 Polypus TUI                         [quality] 🔒 │
├──────────┬──────────────────────────────────────────┤
│ Chat     │ 📋 Timeline                              │
│          │ ✓ write_file src/server.ts  12:34:01     │
│ "crie um │ ✓ run_command npm test      12:34:05     │
│  servidor│ ✗ run_command npm test      12:34:10     │
│  HTTP"   │ ↻ Agent fixing...                       │
│          │ ✓ write_file src/server.test.ts 12:34:20 │
│          │ ✓ finish                    12:34:30     │
│          │ ─────────────────────────────             │
│          │ 💰 Tokens: 4,230 · $0.008                 │
├──────────┴──────────────────────────────────────────┤
│ 📁 src/server.ts | Edit | Revert | Blame             │
├─────────────────────────────────────────────────────┤
│ > _                                                  │
└─────────────────────────────────────────────────────┘
```

**Tecnologia:** `blessed` + `react-blessed` (já tem React no desktop) ou `bubbletea` (Go).

**Por que fazer:** O REPL atual é funcional mas feio. Uma TUI rica impressiona em demonstrações, publicações no Reddit e vídeos. É "prova social visual".

### 3.2 🔵 **Git Hooks Automáticos**

**O que é:** `polypus init --git-hooks` instala hooks git que chamam o Polypus em eventos:

- `pre-commit`: revisa o diff antes do commit (detecta segredos, código morto, estilo)
- `commit-msg`: sugere mensagem de commit no formato Conventional Commits
- `pre-push`: roda verificações extras antes do push

**Por que fazer:** É um "cavalo de Troia" de adoção — o dev instala um hook e começa a usar o Polypus sem perceber.

### 3.3 🔵 **CLI Pipe Mode (`polypus transform`)**

**O que é:** `cat arquivo.ts | polypus transform "adicione JSDoc" > arquivo-documentado.ts`

**Problema que resolve:** Transformações rápidas sem entrar no loop completo do agente. Útil em scripts e pipelines.

**Outros pipes:**
```
echo "error message" | polypus explain     → explica o erro
cat README.md | polypus translate --lang en → traduz
git diff HEAD~1 | polypus commit-message    → gera mensagem de commit
cat deploy.log | polypus summarize          → resume logs
```

### 3.4 🔵 **Watcher de Diretório (modo daemon)**

**O que é:** `polypus watch ./src` — monitora mudanças em tempo real e age automaticamente:

- Ao salvar: roda typecheck + linter → se falhar, tenta corrigir
- Ao detectar crash loop (processo reinicia várias vezes): analisa e sugere fix
- Ao detectar arquivo novo com nome sugestivo (`bugfix*`, `TODO*`): pergunta se quer implementar

**Tecnologia:** `fs.watch` + debounce.

### 3.5 🔵 **Agente de Documentação**

**O que é:** `polypus docs` — especializado em gerar e manter documentação.

```
polypus docs --src ./src --out ./docs          # gera docs da API
polypus docs --check                            # verifica se docs estão desatualizadas
polypus docs --watch                            # watch mode: atualiza ao salvar
```

**Diferencial:** Usa o entendimento semântico do código (já tem o RAG/index) pra gerar documentação contextualizada, não só JSDoc extraído.

### 3.6 🔵 **Polypus como "Git Co-pilot"**

**O que é:** Comandos git inteligentes que vão além do que o git oferece:

```
polypus git squash "últimos 5 commits"          # squash com summary
polypus git merge-branch feat/x                 # merge com resolução automática de conflitos
polypus git rebase main                         # rebase com auto-fix de conflitos
polypus git changelog                           # gera changelog do histórico
polypus git bisect "teste quebrou"              # git bisect automatizado
```

### 3.7 🔵 **Agente de Refatoração**

**O que é:** `polypus refactor` — especializado em refatorar código com segurança.

```
polypus refactor "extraia a lógica de autenticação para um middleware"
polypus refactor "renomeie `user` para `customer` em todo o projeto" --dry-run
polypus refactor --check                        # detecta oportunidades de refatoração
```

**Valor:** Refatoração manual é arriscada e cara. Um agente que faz com diff revisável é um dos maiores valores que uma ferramenta de IA pode entregar.

### 3.8 🔵 **MCP Client Universal**

**O que é:** Já que o Polypus suporta MCP como cliente (`src/core/mcp/`), ele pode se conectar a **qualquer** servidor MCP (banco de dados, APIs, sistema de arquivos). Mas hoje isso é configuração manual.

**Ideia:** Um comando `polypus mcp discover` que:
- Escaneia servidores MCP populares instalados
- Lista tools disponíveis e sugere ativar
- Vira um "app store" de capacidades pro agente

---

## 4. Matriz de Priorização (Impacto × Esforço)

| Superfície | Esforço | Alcance | Prioridade | Sinergia |
|------------|---------|---------|------------|----------|
| **GitHub Action reutilizável** | 🟢 Baixo | Alto | **P0** | Reusa CI já existente |
| **MCP Server** | 🟢 Baixo | Alto | **P0** | Abre pro ecossistema Claude/Cline |
| **API Server** | 🟢 Baixo | Alto | **P0** | Base pra todas as outras |
| **GitHub App (bot)** | 🟡 Médio | Alto | **P1** | Público-alvo principal |
| **Git Hooks** | 🟢 Baixo | Médio | **P1** | "Cavalo de Troia" de adoção |
| **CLI Pipe Mode** | 🟢 Baixo | Médio | **P1** | Fácil de implementar, viral no Twitter |
| **Discord Bot** | 🟡 Médio | Alto | **P2** | Comunidades open source |
| **Neovim Plugin** | 🟡 Médio | Médio | **P2** | Formadores de opinião |
| **TUI Rica** | 🔴 Alto | Médio | **P2** | Showcase visual |
| **JetBrains Plugin** | 🔴 Alto | Alto | **P3** | Outro ecossistema |
| **Telegram Bot** | 🟡 Médio | Médio | **P3** | Mobile-first devs |
| **Obsidian Plugin** | 🟡 Médio | Baixo | **P3** | Nicho |
| **Watcher/daemon** | 🔴 Alto | Baixo | **P4** | Complexo, valor marginal |
| **Agente Docs** | 🟡 Médio | Médio | **P4** | Pode ser skill, não produto |
| **Git Copilot** | 🟡 Médio | Médio | **P4** | Legal mas nicho |
| **Refatoração** | 🔴 Alto | Médio | **P4** | Complexo, alto risco de bugs |

### Prioridades recomendadas

**Sprint imediato (P0):**
1. **MCP Server** — dias de trabalho, abre pro ecossistema de agentes existente (Claude Desktop, Cline, Continue)
2. **GitHub Action reutilizável** — encapsular o que já existe
3. **API Server** — base pra todas as integrações futuras

**Sprint 2 (P1):**
4. **CLI Pipe Mode** — baixo esforço, viral fácil
5. **Git Hooks** — instala com `polypus init --git-hooks`
6. **GitHub App** — webhook handler pro ecossistema GitHub

**Sprint 3 (P2):**
7. **Discord Bot** — médio esforço, times adoram
8. **Neovim Plugin** — nicho de formadores de opinião
9. **TUI Rica** — showoff pra vídeos e demos

---

## 5. Padrão de Implementação (Reuso de Core)

**Todas** as superfícies seguem o mesmo padrão:

```
┌──────────────┐     stdin/stdout      ┌──────────────┐
│  Superfície  │ ◄────── NDJSON ──────► │  CLI Core    │
│  (UI/Bot/     │      (stream)         │  (polypus    │
│   Plugin)     │                       │   run --json │
└──────────────┘                       │   --stream)  │
                                        └──────────────┘
```

Ou, quando performance importa:

```
┌──────────────┐     child_process     ┌──────────────┐
│  Superfície  │ ◄── spawn + JSON ────►│  lib entry   │
│  (API/Bot)   │      (in-process)     │  (@gaberrb/  │
│              │                       │   polypus/lib)│
└──────────────┘                       └──────────────┘
```

Isso significa que **cada nova superfície** requer:
1. Adaptador de transporte (stdin/stdout, HTTP, WebSocket, Discord, etc.)
2. UI/UX específica da plataforma
3. Zero mudança no motor do agente

---

## 6. Roadmap Consolidado (com base nas prioridades acima)

```
Mês 1: Fundação
├── API Server (REST + WS)
├── MCP Server
└── GitHub Action reutilizável

Mês 2: Adoção orgânica
├── GitHub App (bot)
├── CLI Pipe Mode
└── Git Hooks

Mês 3: Comunidades
├── Discord Bot
├── Neovim Plugin
└── TUI Rica (showcase)

Mês 4+: Expansão
├── JetBrains Plugin
├── Telegram Bot
├── Obsidian Plugin
└── Agente de Refatoração
```

---

## 7. Questões em Aberto

- **Q1** — API Server deve ser uma dependência separada (`polypus serve`) ou opcional no mesmo pacote?
- **Q2** — O MCP Server deve ser parte do CLI ou um pacote separado (`@gaberrb/polypus-mcp`)?
- **Q3** — Devemos fazer o GitHub App antes ou depois do API Server? (App precisa de webhook, API Server é o webhook)
- **Q4** — Neovim Plugin em Lua puro ou via `remote` (RPC)? Lua é mais leve mas menos capaz.
- **Q5** — A TUI rica merece um pacote próprio ou fica no CLI? (Se for grande, separado)
- **Q6** — O Discord Bot precisa de um servidor 24/7. Isso quebra o modelo "sem servidor central" do Polypus?
- **Q7** — CLI Pipe Mode: new command (`polypus transform`) ou flag de `polypus run`?

---

> **Próximo passo:** Escolher 2-3 superfícies do P0/P1 para implementar. Sugiro começar pelo **MCP Server** (dias de trabalho, abre o ecossistema) + **Git Hooks** (adoção passiva) + **CLI Pipe Mode** (viral fácil).