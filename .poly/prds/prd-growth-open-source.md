# PRD: Iniciativa de Crescimento Open Source — "Polypus Showcase & Community"

> **Status:** Rascunho · **Autor:** GaberRB · **Versão:** 0.1  
> **Problema:** ~10 usuários, ~3 stars no GitHub, visibilidade próxima de zero  
> **Oportunidade:** Produto maduro (CLI + VSCode + Desktop + CI/CD autônomo), diferencial único (modelos sem function-calling), bilíngue (PT-BR + EN), e ninguém conhece.

---

## 1. Diagnóstico — Por que só 10 usuários?

Analisando o repositório, site, PRDs existentes (extensão VSCode, desktop, Polypus OS) e o ecossistema, os gargalos de distribuição são:

| Gargalo | Evidência |
|---------|-----------|
| **Zero conteúdo escrito** | Não há posts em dev.to, Medium, Hashnode, blog. Nenhum tutorial ou comparação. |
| **Zero presença social** | Sem conta no X/Twitter, LinkedIn, YouTube. O demo existe mas está escondido no site. |
| **Zero listas públicas** | Não está em awesome-cli, awesome-vscode, awesome-open-source, console.dev, daily.dev, TLDR. |
| **Sem "prova social"** | 3 stars, 0 forks — não há métrica que um visitante confie. |
| **Sem comunidade** | Não há Discussions ativas, Discord, nem canal de feedback público. |
| **Onboarding só no terminal** | Para experimentar, precisa `npm i -g`, setup, API key. Sem sandbox online. |
| **Marca zero** | O mascote existe mas não é usado fora do site. O storytelling (polvo de muitos tentáculos) não é contado. |
| **Bilíngue como fraqueza** | PT-BR default reduz alcance global; EN é segundo idioma mas não há conteúdo em inglês que atraia. |
| **Sem métricas de uso** | "10 usuários" é estimativa — sem telemetria (por design), não há dados pra saber onde melhorar. |

## 2. Público-alvo & persona

**Persona principal: Dev Open Source entusiasta de IA**
- Já usa ou já ouviu falar de Claude Code, Cline, Continue, Copilot
- Quer uma alternativa **aberta, sem vendor lock-in, que funcione com modelos grátis**
- Tem projeto open source próprio e gosta de ferramentas que **também são open source**
- Lê Hacker News, r/programming, dev.to, acompanha lançamentos no GitHub Trending
- Prioriza privacidade e controle (não quer telemetria)
- Potencial contribuidor: adora uma ferramenta bem engenhada com CI/CD elegante

**Persona secundária: Dev brasileiro**
- O mercado BR de tecnologia é enorme e o Polypus é o **único** agente de IA **nativo em PT-BR**
- O PIX como forma de doação é um diferencial cultural forte
- Canais: YouTube BR (Filipe Deschamps, Lucas Montano, Código Fonte TV), grupos de Telegram/WhatsApp

## 3. Visão geral da iniciativa

**Nome:** "Polypus Showcase & Community"  
**Objetivo:** Levar Polypus de 10 → 500 usuários ativos em 3 meses, através de **conteúdo, comunidade e vitrine de casos de uso** — sem telemetria, sem gastar em anúncio.

**Três pilares:**
```
┌─────────────────────────────────────────────────────────┐
│              Polypus Growth Initiative                    │
├─────────────────┬───────────────────┬────────────────────┤
│   🎪 SHOWCASE   │  📣 DISTRIBUIÇÃO  │  🤝 COMUNIDADE     │
│                 │                   │                    │
│ • Site galeria  │ • Conteúdo dev.to │ • Discussions      │
│ • Badge "Built  │ • Awesome lists   │ • Issue templates  │
│   with Polypus" │ • Hacker News     │ • Good first issue │
│ • Comando       │ • YouTube         │ • Contributor      │
│   `showcase`    │ • Reddit          │   onboarding       │
│ • Template de   │ • Twitter/X       │ • Discord lite     │
│   projeto       │ • Release notes   │ • User stories     │
└─────────────────┴───────────────────┴────────────────────┘
```

## 4. Funcionalidades & entregas

### 🎪 Pilar 1: Showcase (feature de produto + site)

**Por que:** A maior barreira de adoção é "nunca vi funcionando". Um showcase público prova o valor.

#### 4.1 Comando `polypus showcase` (novo)

Gera um **card Markdown/HTML** com metadados do projeto construído com Polypus.

```
polypus showcase                          # mostra o card no terminal
polypus showcase --out showcase.md        # salva como markdown pra README
polypus showcase --json                   # JSON pra integrar com CI
```

**Conteúdo do card:**
- 🐙 **Built with Polypus** badge
- Nome do projeto · descrição · linguagem principal
- Estatísticas: tasks executadas, arquivos criados/editados, tokens totais, modelo usado
- "How it was built" — resumo gerado pelo agente do que foi feito
- Link pro repositório + link pro Polypus

**Metadata gravada em `.poly/showcase.json`:**
```json
{
  "project": "meu-projeto",
  "description": "API REST com Fastify",
  "tasks": [
    { "description": "criar servidor HTTP", "model": "gpt-4o-mini", "files": ["src/server.ts"], "tokens": 12000 }
  ],
  "totalTasks": 1,
  "totalTokens": 12000,
  "badgeUrl": "https://img.shields.io/badge/Built%20with-Polypus-7A4ADE"
}
```

#### 4.2 Galeria no site (`docs/showcase.html`)

Página no site do Polypus com cards de projetos da comunidade.

- Formulário pra submeter: link do repo + `polypus showcase --json` output
- Curadoria manual (mantenedor aprova)
- Filtro por linguagem e modelo
- Cada card tem: badge, descrição, link, linguagem

#### 4.3 Badge "Built with Polypus"

Shields.io badge que projetos open source podem colocar no README:
```
[![Built with Polypus](https://img.shields.io/badge/Built%20with-Polypus-7A4ADE?style=flat&logo=data:image/svg%2bxml;base64,…)](https://gaberrb.github.io/polypus)
```

### 📣 Pilar 2: Distribuição (conteúdo + listas)

**Por que:** Sem conteúdo, não existe no radar dos devs.

#### 2.1 Conteúdo âncora (escrita única, distribuição em 5+ canais)

| Peça | Formato | Canais | Prazo |
|------|---------|--------|-------|
| "Polypus: o harness que faz QUALQUER modelo de IA codar — até os locais" | Tutorial + comparação | dev.to, Medium, Hacker News, r/javascript, r/node | Semana 1 |
| "5 ferramentas de coding agent open source em 2025 — e por que o Polypus é diferente" | Comparativo | dev.to, Hashnode, LinkedIn | Semana 2 |
| "How we built a CI/CD pipeline where AI implements its own issues" | Case técnico | dev.to, Hacker News, r/programming | Semana 3 |
| "How to code with local LLMs (Ollama) using Polypus" | Tutorial | dev.to, r/ollama, r/LocalLLaMA | Semana 4 |

**Estratégia de distribuição de cada post:**
1. dev.to (publish nativo) + cross-post no Medium
2. Hacker News (submissão manual, horário bom)
3. Reddit: r/javascript, r/node, r/programming, r/opensource, r/ollama, r/LocalLLaMA
4. LinkedIn (GaberRB posta)
5. Twitter/X (thread resumindo)
6. GitHub Discussions (link)

#### 2.2 Awesome Lists (PRs de uma vez)

Submissões de PR para incluir Polypus nestas listas:

| Lista | Likeyhood | URL |
|-------|-----------|-----|
| awesome-cli | ✅ Média | https://github.com/umutphp/awesome-cli |
| awesome-command-line | ✅ Média | https://github.com/iggredible/awesome-command-line |
| awesome-vscode | ✅ Alta (extensão já publicada) | https://github.com/viatsko/awesome-vscode |
| awesome-open-source | ✅ Média | https://github.com/cnblab/awesome-open-source |
| awesome-llm-coding | ✅ Alta | https://github.com/mezbaul-h/awesome-llm-coding |
| awesome-coding-agents | ✅ Alta | https://github.com/nicepkg/awesome-coding-agents |
| awesome-ollama | ✅ Alta (suporte nativo) | https://github.com/phospho-app/awesome-ollama |
| awesome-github-actions | ✅ Alta (CI/CD autônomo) | https://github.com/sdras/awesome-actions |
| awesome-developer-tools | ✅ Média | https://github.com/mauriciovieira/awesome-developer-tools |

#### 2.3 YouTube / vídeo curto

- Pegar o vídeo demo existente (`assets/DemoPolypus.mp4` e `assets/vscodePolypus.mp4`)
- Cortar em: 30s (short/reels) + 2min (demo completo) + 10min (tutorial)
- Publicar no YouTube (canal do GaberRB ou criar um do Polypus)
- Embed no site (já tem o player)
- Postar no r/programming, LinkedIn, Twitter

#### 2.4 Release notes automáticas com copiar-colar

Melhorar o `auto-release.yml` para também:
- Postar no GitHub Discussions como "🎉 vX.Y.Z"
- Gerar um tweet/bluesky rascunho

### 🤝 Pilar 3: Comunidade

**Por que:** Open source sem comunidade é só código num repositório.

#### 3.1 GitHub Discussions (ativar)

- Ativar Discussions no repositório
- Categorias: 🎉 Showcase (compartilhe seu projeto), 💬 General, 🐛 Bugs, 💡 Ideas, 🙏 Q&A
- Template de showcase Discussions: link do repo + output do `polypus showcase`

#### 3.2 Good First Issues + Contributing Guide aprimorado

- Label `good first issue` com issues pequenas e bem descritas
- Melhorar CONTRIBUTING.md com:
  - Print de tela do fluxo
  - Link pro `rules.md` e `context.md`
  - Template de "como rodar localmente" com prints
  - Seção de "onde pedir ajuda" (Discussions)
- Label `help wanted` e `hacktoberfest` pra outubro

#### 3.3 Newsletter / changelog assinável

- Criar um `docs/changelog.html` (página dedicada) com feed RSS
- Badge de assinatura: "receba atualizações por e-mail" (pode ser um link mailto ou serviço gratuito como Buttondown)
- Toda release gera um resumo em português e inglês

## 5. Requisitos técnicos

### Funcionais

| # | Requisito | Esforço | Depende de |
|---|-----------|---------|------------|
| RF1 | Comando `polypus showcase` + `--out`, `--json` | M (3-5 dias) | `src/core/agent/usage.ts`, `src/core/scaffold/` |
| RF2 | Gravação automática de metadata de tarefas em `.poly/showcase.json` | P (1-2 dias) | RF1 |
| RF3 | Página `docs/showcase.html` com galeria de projetos | M (3-5 dias) | Design do card |
| RF4 | Badge shields.io "Built with Polypus" | P (horas) | Nenhuma |
| RF5 | **Melhoria:** `polypus init` já gerar `.poly/` com showcase template | P (1 dia) | Nenhuma |
| RF6 | Conteúdo: 4 posts em dev.to + distribuição HN/Reddit/LinkedIn/Twitter | M (8-12h de escrita) | Nenhum — só ação do mantenedor |
| RF7 | Submissão para 5+ awesome lists | P (2-4h) | Nenhum — só PRs |
| RF8 | Ativar GitHub Discussions + templates | P (1h) | Nenhum |
| RF9 | Labels `good first issue`, `help wanted` em issues existentes | P (1h) | Issues bem descritas |
| RF10 | YouTube: editar e publicar 3 vídeos | M (4-6h) | Vídeos demo existentes |
| RF11 | Página `docs/changelog.html` com RSS | P (2-3 dias) | Design |

### Não-funcionais

- **Nenhuma telemetria** — o showcase é opt-in, o metadata é local, nada sai da máquina
- **Badge é opcional** — o usuário decide se coloca no README
- **Zero nova dependência** — tudo com stdlib + o que já existe
- **i18n** — mensagens do comando `showcase` nos dois catálogos
- **Showcase no site é estático** — usa HTML+JS puro como o resto do site; sem backend

## 6. Dependências & riscos

| # | Risco | Prob. | Impacto | Mitigação |
|---|-------|-------|---------|-----------|
| R1 | Ninguém submete showcase | Alta | Alto | Cuidar pessoalmente dos primeiros 10 showcases (projetos do próprio mantenedor) + chamar early adopters |
| R2 | Posts no HN/Reddit não viralizam | Alta | Médio | Estratégia de "qualidade > quantidade": um bom post vale mais que 10 genéricos. Testar título e horário. |
| R3 | Awesome lists demoram a aprovar | Média | Baixo | Submeter tudo de uma vez; algumas aceitam em dias |
| R4 | `polypus showcase` vira ruído que ninguém usa | Média | Baixo | Integrar com o fluxo natural (toda task registra metadata automaticamente) |
| R5 | Falta de tempo do mantenedor pra criar conteúdo | Alta | Alto | Conteúdo pode ser gerado com auxílio do próprio Polypus (usar o agente autônomo pra drafts) |
| R6 | Comunidade não engaja (Discussions vazias) | Alta | Médio | O mantenedor precisa ***plantar*** as primeiras discussions: "o que você construiu com Polypus?", "qual modelo você usa?" |

## 7. Critérios de aceite (marcar quando cumprido)

- [ ] **CA1** — `polypus showcase` gera um card Markdown válido com badges e metadados.
- [ ] **CA2** — `polypus showcase --json` produz JSON parseable com todas as tasks do `.poly/showcase.json`.
- [ ] **CA3** — Comando tem i18n nos dois catálogos e help no `--help`.
- [ ] **CA4** — `polypus run` e `polypus swarm` registram metadata básico em `.poly/showcase.json`.
- [ ] **CA5** — `docs/showcase.html` carrega e exibe cards de projetos submetidos, funcional estático.
- [ ] **CA6** — Badge shields.io "Built with Polypus" é pública e aponta pro site.
- [ ] **CA7** — 4 artigos publicados em dev.to (ou blog alternativo) e distribuídos em ≥ 3 canais cada.
- [ ] **CA8** — Polypus listado em ≥ 5 awesome lists do ecossistema.
- [ ] **CA9** — GitHub Discussions ativo com ≥ 3 categorias e 1 post do mantenedor em cada.
- [ ] **CA10** — ≥ 5 issues com `good first issue` e descrições acionáveis.
- [ ] **CA11** — Pelo menos 1 vídeo publicado no YouTube mostrando o Polypus em ação.
- [ ] **CA12** — Showcase inicial com ≥ 5 projetos reais na galeria (incluindo projetos do mantenedor).

## 8. Métricas de sucesso

| Métrica | Baseline (hoje) | 1 mês | 3 meses | Ferramenta |
|---------|----------------|-------|---------|------------|
| GitHub stars | 3 | 30 | 150+ | GitHub |
| npm downloads (semanal) | ~5? | 50 | 200+ | npm |
| Usuários ativos estimados | ~10 | 50 | 500+ | Estimativa (sem telemetria) |
| Showcase submetidos | 0 | 5 | 30+ | Site |
| Awesome lists incluído | 0 | 5 | 8+ | Verificação |
| Articles publicados | 0 | 4 | 10+ | dev.to/Medium |
| GitHub Discussions posts | 0 | 10 | 50+ | GitHub |
| Contributors (não-mantenedor) | 0 | 1 | 5+ | GitHub Insights |
| YouTube views | 0 | 500 | 5000+ | YouTube |

## 9. Roadmap sugerido

### Sprint 1 (Semanas 1-2): Fundação técnica + conteúdo âncora

**Produto:**
- [ ] Implementar `polypus showcase` (comando, metadata, badge)
- [ ] Criar `docs/showcase.html` com galeria estática
- [ ] Melhorar `polypus init` pra gerar `.poly/` mais rico
- [ ] Publicar badge shields.io

**Conteúdo:**
- [ ] Escrever e publicar primeiro artigo âncora (tutorial + comparação)
- [ ] Submeter primeira leva de awesome lists (5+)
- [ ] Gravar e postar vídeo curto (30s) + demo (3min)

### Sprint 2 (Semanas 3-4): Comunidade + distribuição

**Produto:**
- [ ] Ativar GitHub Discussions com templates
- [ ] Criar labels `good first issue` + `help wanted`
- [ ] Populados os primeiros showcases (projetos do mantenedor)

**Conteúdo:**
- [ ] Segundo artigo (comparativo de ferramentas)
- [ ] Post nos subreddits apropriados
- [ ] Thread no Twitter/X
- [ ] Post no LinkedIn

### Sprint 3 (Semanas 5-8): Engajamento

- [ ] Terceiro artigo (CI/CD autônomo case técnico)
- [ ] Acompanhar awesome list PRs (follow-ups)
- [ ] Responder comments nos posts
- [ ] Recrutar primeiros showcases da comunidade via Discussions
- [ ] Se houver tração: quarto artigo (Ollama + Polypus tutorial)

### Sprint 4 (Semanas 9-12): Aceleração

- [ ] Avaliar métricas vs baseline
- [ ] Se engajamento OK: criar `docs/changelog.html` com RSS
- [ ] Participar de eventos open source (Hacktoberfest)
- [ ] Avaliar necessidade de Discord/Matrix

## 10. Fora de escopo (explícito)

- ❌ Telemetria ou analytics no produto (viola premissa do `rules.md`)
- ❌ Anúncios pagos (Google Ads, Twitter Ads, GitHub Sponsors)
- ❌ Sandbox online (try.polypus.dev) — muito caro de manter
- ❌ Parcerias pagas ou sponsorship
- ❌ Migrar de GitHub Pages para Vercel/Netlify por enquanto
- ❌ Criar organização separada para o Polypus
- ❌ Open sourcing de serviços (tudo já é open source)

## 11. Questões em aberto

- **Q1** — Canal do YouTube: criar canal do Polypus ou publicar no pessoal do GaberRB?
- **Q2** — Newsletter: serviço gratuito (Buttondown, Substack) ou RSS puro?
- **Q3** — O badge "Built with Polypus" deve ser obrigatório no showcase, ou opcional?
- **Q4** — Devemos ter um template de `polypus showcase` que gere automaticamente um Discussion post?
- **Q5** — A galeria de showcase pede curadoria ou é auto-serviço? (Curadoria = qualidade; auto = escala)
- **Q6** — Qual modelo de linguagem usar pra escrever os posts? (O próprio Polypus pode ajudar nos drafts)
- **Q7** — Devemos focar o conteúdo primeiro em PT-BR (público nicho, menos concorrência) ou EN (maior alcance)?

---

> **Próximo passo sugerido:** discutir as Qs em aberto, especialmente Q7 (idioma do conteúdo) e Q1 (YouTube), pois definem onde investir o tempo limitado do mantenedor.