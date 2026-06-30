# PRD: Extensão Polypus v0.2 — controles, modos, contexto, thinking

> Status: rascunho · Origem: feedback do usuário pós-publicação 0.1.0 · Dono: GaberRB

## 1. Problema / Contexto

A 0.1.0 publicada é um chat funcional mas **cru** ("não tá usável ainda"): só caixa de texto + stream.
Falta o painel de controle que torna um assistente agêntico realmente usável — escolher o nível de
autonomia (perguntar antes de editar / editar sozinho / planejar), trocar modelo, ajustar esforço,
gerenciar contexto, e voltar atrás. A referência é a extensão do Claude Code. A maior parte desses
controles **já existe no motor do Polypus** (modos, perfis, agentes, mentions, sessões) e só precisa
ser exposta no painel; uma minoria (rewind, thinking) precisa de trabalho novo no engine.

## 2. Objetivo & métrica de sucesso

Tornar a extensão **usável de verdade**: o desenvolvedor controla autonomia, modelo, esforço e
contexto sem sair do painel.

- **Sucesso:** os 3 modos de execução funcionam e são alternáveis por Shift+Tab; trocar modelo e
  perfil reflete na próxima run; mascote Polypus e indicador de modo visíveis.
- **Métrica:** 0 controles "decorativos" — todo botão exposto altera comportamento real de uma run
  (verificável). Fracasso = botão que não faz nada.

## 3. Usuários & cenários

Mesma persona da 0.1.0 (dev BYO-key OpenRouter). Caminho feliz: abre o painel → escolhe o modo
(Ask/Auto/Plan) → opcionalmente troca modelo e ajusta esforço → manda a tarefa → durante a run,
aprova edições (ou Shift+Tab pra aprovar em lote) → pode limpar a conversa ou voltar atrás (rewind).

## 4. Requisitos

### Funcionais — Tier A (motor já suporta; só UI + plumbing do transport/host)
- **RF1 — Modos de execução:** seletor Ask before edits (`review`) / Edit automatically (`bypass`) /
  Plan mode (`plan`), com ícones. O modo escolhido vira `--mode` na run.
- **RF2 — Shift+Tab:** alterna `review`↔`bypass` na sessão; banner sob o mascote anuncia o atalho.
- **RF3 — Indicador de modo ativo** dentro da barra de input (canto inferior direito).
- **RF4 — Switch model:** picker que lista os agentes configurados (e modelos OpenRouter); a escolha
  passa `--agent` na run. Exibe modelo/preço ativos (absorve o T10 da #185).
- **RF5 — Perfil/Effort:** controle mapeando perfis discretos `fast`/`quality` (+ verify/plan-first);
  passa `--fast`/`--quality` na run. Apresentado como níveis, não slider contínuo falso.
- **RF6 — Toggle fast mode** com atalho dedicado.
- **RF7 — Clear conversation:** dropa a sessão atual (novo `sessionId`), zera a thread.
- **RF8 — @mention / Attach file:** picker `@arquivo` (já temos `listFiles`/`readFile`) + anexar
  arquivo local; injeta o conteúdo no prompt.
- **RF9 — Ctrl+Esc:** keybinding que foca/desfoca o painel de chat.
- **RF10 — Mascote Polypus + banner:** portar `PolypusMascot.tsx` pro `chat-ui`; banner "Press
  Shift+Tab to auto-approve edits" sob o mascote. (NÃO o alien genérico — usar o mascote do Polypus.)

### Funcionais — Tier B (precisa de engine novo)
- **RF11 — Rewind:** voltar a thread a um ponto anterior — trunca a sessão salva até a mensagem N e
  re-resume. Requer suporte no session-store (truncar) + UI de pontos de retorno.
- **RF12 — Thinking tokens:** exibir o raciocínio (CoT) do modelo num bloco colapsável. **Requer
  engine novo em camadas:** (a) provider envia o parâmetro de reasoning (`thinking` no Anthropic,
  `reasoning`/`reasoning_effort` no OpenRouter) e parseia o conteúdo de reasoning do stream;
  (b) o loop do agente emite reasoning como evento distinto; (c) novo evento NDJSON
  `thinking_delta`; (d) reducer + componente renderizam o bloco. **Depende do modelo emitir
  reasoning** — modelos grátis podem não emitir.

### Não-funcionais
- **RNF1 — Zero controle decorativo:** todo controle exposto altera uma run real (CA verificável).
- **RNF2 — Reuso:** novos componentes vivem em `packages/chat-ui` (desktop herda no futuro).
- **RNF3 — Não-regressão do CLI:** Tier B adiciona reasoning como **opt-in**; o caminho atual
  (sem reasoning) não muda.
- **RNF4 — Tema nativo:** todos os controles com tokens `var(--vscode-*)`.

## 5. Fora de escopo
- **Input de voz (mic)** — descartado (suporte instável no webview, valor duvidoso).
- "Effort" como slider contínuo de verdade (o motor tem níveis discretos; expor um slider falso seria
  controle decorativo, viola RNF1).
- Migração do desktop pro `chat-ui` (depende do `feat/agents-picker` mergear).

## 6. Dependências & riscos
- **R1 — Thinking depende de provider+modelo.** Mitigação: detectar suporte e só mostrar o bloco
  quando há reasoning; degradar silenciosamente quando não há.
- **R2 — Rewind e o contrato de sessão.** Truncar sessão pode confundir o `--resume`. Mitigação:
  rewind cria uma nova sessão derivada (não muta a original).
- **R3 — Escopo grande.** Mitigação: entregar Tier A primeiro (usável), Tier B em seguida.

## 7. Critérios de aceite
- [ ] **CA1** — Trocar pra "Edit automatically" e rodar → edições aplicam sem pedir aprovação.
- [ ] **CA2** — Shift+Tab alterna o indicador entre Ask/Auto e a próxima run respeita.
- [ ] **CA3** — Plan mode → a run produz plano sem editar arquivos.
- [ ] **CA4** — Trocar modelo no picker → a próxima run usa o agente/modelo escolhido (visível no painel).
- [ ] **CA5** — Alternar fast/quality → reflete no comportamento (verify/plan on/off) da run.
- [ ] **CA6** — Clear conversation → thread zera e a próxima run começa sessão nova.
- [ ] **CA7** — `@arquivo` injeta o conteúdo do arquivo no prompt enviado.
- [ ] **CA8** — Ctrl+Esc foca o painel.
- [ ] **CA9** — O mascote exibido é o do Polypus; o banner Shift+Tab aparece.
- [ ] **CA10** — Rewind a um ponto anterior → nova thread derivada continua daquele ponto.
- [ ] **CA11** — Com um modelo que emite reasoning, o bloco "thinking" aparece colapsável; sem, nada quebra.

## 8. Questões em aberto
- **Q1** — Effort: expor só fast/quality, ou também sliders de verify/plan-first/maxSteps separados? (decide: GaberRB)
- **Q2** — Rewind por mensagem (cada turno) ou por "checkpoint" manual? (decide: GaberRB)
- **Q3** — Thinking: começar só pelo OpenRouter `reasoning` (cobre os modelos do usuário) e deixar Anthropic depois? (decide: GaberRB)
