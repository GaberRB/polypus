# PRD: Benchmark diagnóstico do Polypus — ferramenta vs ferramenta, custo baixo

> Status: rascunho · Origem: sessão de grill 2026-07-01 · Dono: GaberRB
> Governança: fora da pipeline issue-gated (decisão explícita do dono para este caso)

## 1. Problema / Contexto

A tese central do Polypus — "qualidade equivalente às ferramentas líderes com custo muito menor,
via engenharia" (perfis quality/fast, caching, diagnostics, checkpoints) — nunca foi medida contra
concorrentes reais. Sem dado, o marketing é opinião e o roadmap é palpite. Não existe fonte pública
que compare **ferramentas** (não modelos) com o modelo segurado constante e coluna de tokens/custo,
então o experimento precisa ser rodado localmente. Ordem dos objetivos: **diagnóstico honesto
primeiro**; marketing só como consequência se o número sobreviver ao critério pré-registrado.

## 2. Objetivo & métrica de sucesso

Produzir um benchmark reprodutível Polypus vs OpenCode vs Aider (mesmo modelo, mesmas tarefas,
mesma máquina) que responda: *o Polypus entrega taxa de acerto equivalente gastando menos tokens?*

**Critério pré-registrado (definido ANTES de rodar, imutável durante o experimento):**

- **Publica** se: acerto do Polypus ≥ (melhor concorrente − 3 pontos percentuais) **E**
  tokens do Polypus ≤ 75% dos tokens do concorrente nas mesmas tarefas.
- **Segura e vira roadmap** se qualquer condição falhar: cada gap identificado vira issue;
  re-run pós-correções; só a versão que passar no critério vira material de marketing.
- Resultado ruim **não pode ser descartado silenciosamente** — vira issue com o dado anexado.

**Métrica de fracasso do projeto:** benchmark não-reprodutível (re-run com mesmos pins divergindo
além do ruído esperado) ou critério alterado depois de ver resultado.

## 3. Usuários & cenários

**Persona 1 — o próprio mantenedor (diagnóstico):** roda o benchmark local, recebe relatório com
acerto/tokens/tempo por ferramenta e lista de tarefas onde o Polypus falhou e concorrentes
passaram (os gaps). Caminho feliz: `npm run bench` → horas depois → `results/report.md` pronto.

**Persona 2 — dev avaliando o Polypus (marketing, condicional):** lê um post/README com o gráfico
acerto × tokens, a metodologia linkada e o repo do benchmark pra reproduzir.

**Edge cases relevantes:**
- Ferramenta trava/loop infinito numa tarefa → timeout por sessão, conta como falha, registra.
- Rate-limit no meio do run → retry com backoff; se persistir, marca a sessão como `rate_limited`
  e re-agenda (nunca conta como falha da ferramenta).
- Modelo indisponível no OpenRouter no dia do run → aborta o run inteiro (não troca de modelo).
- Exercício com teste flaky → detectado na calibração (rodar testes 2× sem agente); excluído
  do subset com justificativa registrada.

## 4. Requisitos

### Funcionais

**Trilha 1 — Ringue (Polypus vs OpenCode vs Aider):**
- **RF1 — Subset de tarefas:** ~40-60 exercícios do benchmark polyglot do Aider (Exercism),
  mix de linguagens e dificuldades, snapshot congelado em repo/pasta própria. Critério de
  seleção documentado e publicado junto do resultado.
- **RF2 — Runner headless:** script que invoca cada ferramenta em modo não-interativo sobre o
  mesmo exercício (`polypus run`, `opencode run`, `aider --message`), com prompt idêntico,
  workspace limpo por sessão e timeout configurável.
- **RF3 — Veredito objetivo:** acerto = suíte de testes do próprio Exercism passa após a sessão.
  Sem julgamento humano ou LLM-judge.
- **RF4 — Repetição anti-ruído:** cada (tarefa × ferramenta) roda 3×; acerto por maioria 2/3.
- **RF5 — Medição neutra de tokens:** tokens/custo lidos da **API de usage/generations do
  OpenRouter** (por chave de API dedicada por ferramenta), nunca do auto-reporte da ferramenta.
- **RF6 — Relatório:** gera `report.md` + `results.jsonl` com, por ferramenta: taxa de acerto,
  tokens totais/medianos por tarefa, custo USD, tempo de parede, tarefas falhas listadas.
  Aplica o critério pré-registrado do §2 automaticamente e imprime o veredito publica/segura.
- **RF10 — Qualidade da entrega (objetiva, sem LLM-judge):**
  (a) **integridade do harness:** hash dos arquivos de teste antes/depois da sessão; qualquer
  modificação = veredito `DESCLASSIFICADO` (motivo `test_tampered`), pior que falha;
  (b) **concisão:** LOC da solução entregue (linhas não-vazias/não-comentário) como métrica
  secundária reportada por ferramenta;
  (c) **escopo do diff:** arquivos tocados fora do necessário contam como métrica de ruído.
  Nenhuma dessas vira critério de publicação sozinha — são colunas do relatório e insumo de gap.

**Trilha free — comportamento com modelo gratuito:**
- **RF7 — Run reduzido:** ~15 exercícios × 1 run × 3 ferramentas com `openai/gpt-oss-120b:free`.
  Sem métrica de tempo (rate-limit distorce). Pergunta respondida: a engenharia da ferramenta
  segura modelo fraco, ou todas degradam igual?

**Trilha 2 — Stress/diagnóstico (só Polypus):**
- **RF8 — Suíte de stress:** 10-15 tarefas no repo real do polypus, cobrindo: contexto enorme,
  refactor multi-arquivo, tarefa ambígua, teste que falha de primeira, sessão longa
  (checkpoints/rewind), interrupção e resume. Roda no Windows nativo (ambiente do usuário real
  faz parte do diagnóstico).
- **RF9 — Saída da trilha 2:** para cada falha, um registro estruturado (tarefa, sintoma,
  transcript, tokens) pronto pra virar corpo de issue.

### Não-funcionais
- **RNF1 — Reprodutibilidade:** lockfile do experimento com versões exatas das 3 ferramentas,
  ID exato do modelo (`deepseek/deepseek-chat*`), temperatura, commit do snapshot de exercícios
  e do runner. Re-run com mesmos pins deve ser comparável.
- **RNF2 — Custo:** teto **US$ 15** no experimento inteiro (DeepSeek V3 no ringue; free na
  trilha free). Runner imprime custo acumulado e para se estourar o teto.
- **RNF3 — Ambiente:** ringue e trilha free em **WSL2** (evita medir bug de plataforma das
  ferramentas concorrentes); trilha 2 em Windows nativo.
- **RNF4 — Isolamento:** cada sessão em workspace descartável; ferramenta não vê resultados
  anteriores nem soluções de outros runs; sem cache de disco compartilhado entre ferramentas.
- **RNF5 — Fairness:** mesmo prompt, mesmo modelo, mesma máquina, mesma rede, config default
  de cada ferramenta (sem tunar concorrente pra baixo nem Polypus pra cima além do que um
  usuário normal faria seguindo o README de cada uma).

## 5. Fora de escopo (explícito)

- **Claude Code, Cursor, Copilot no ringue** — impossível segurar modelo constante sem custo
  alto ou proxy gambiarra. Entram só como contexto de preço no material final, sem alegar
  head-to-head.
- **Terminal-Bench e SWE-bench** — custo/infra incompatíveis com o teto; reavaliar quando o
  benchmark caseiro estiver estável e valer o selo externo.
- **Comparação de modelos** — o modelo é constante por trilha; não é objeto do estudo.
- **Material de marketing em si** (post, gráfico, página) — só depois do veredito "publica".
- **CI re-rodável a cada release** — fase 2, depois do primeiro ciclo completo local.

## 6. Dependências & riscos

- **D1 —** OpenCode e Aider instalados e configuráveis com OpenRouter em WSL2; versões pinadas.
- **D2 —** `polypus run` headless com agente/modelo configurável via flag/env (já existe;
  validar cobertura na task de runner).
- **D3 —** Chaves OpenRouter separadas por ferramenta (atribuição de usage sem ambiguidade).
- **R1 — Variância de modelo** → 3 runs/maioria (RF4); reportar também pass@1 bruto.
- **R2 — Acusação de viés (autor mede o próprio produto)** → pré-registro público do critério,
  seleção de tarefas justificada, tokens por fonte neutra (RF5), runner open source.
- **R3 — Rate-limit free** → trilha free reduzida, sem métrica de tempo, retry com backoff.
- **R4 — Flakiness Windows** → ringue em WSL2; Windows só na trilha 2, onde é intencional.
- **R5 — Estouro do teto de custo** → kill-switch do RNF2 + `polypus estimate` antes do run.

## 7. Critérios de aceite (testáveis)

- [ ] **CA1** — Dado o snapshot de exercícios, quando rodo o runner com `--tool aider --task X`,
  então a sessão executa headless, os testes do Exercism dão veredito e uma linha é gravada em
  `results.jsonl` com tokens vindos da API do OpenRouter.
- [ ] **CA2** — Dado um run completo do ringue (3 ferramentas × subset × 3 reps), quando gero o
  relatório, então `report.md` mostra acerto/tokens/custo/tempo por ferramenta e o veredito
  automático do critério pré-registrado.
- [ ] **CA3** — Dado o mesmo lockfile do experimento, quando re-rodo o ringue, então os pins
  (versões, modelo, temperatura, subset) são idênticos e o relatório declara comparabilidade.
- [ ] **CA4** — Dado uma sessão que excede o timeout, quando o runner a encerra, então ela conta
  como falha com motivo `timeout` (e `rate_limited` nunca conta como falha da ferramenta).
- [ ] **CA5** — Dado o run da trilha 2, quando o Polypus falha numa tarefa de stress, então existe
  um registro estruturado (RF9) suficiente pra abrir issue sem re-investigar do zero.
- [ ] **CA6** — Dado custo acumulado ≥ US$ 15, quando o runner verifica o teto, então aborta e
  preserva os resultados parciais.
- [ ] **CA7** — O critério do §2 está commitado (este PRD) **antes** do primeiro run do ringue.

## 8. Questões em aberto

- **Q1 —** Lista exata dos 40-60 exercícios do subset (dono decide na task de seleção; critério:
  ≥4 linguagens, distribuição de dificuldade do polyglot preservada, zero teste flaky).
- **Q2 —** Goose entra como 4ª ferramenta? (dono; default: não nesta rodada — adicionar depois
  custa só um adapter no runner).
- **Q3 —** Onde o benchmark vive: pasta `bench/` neste repo vs repo separado `polypus-bench`
  (default: `bench/` aqui nesta rodada; extrair pra repo próprio se/quando virar marketing público).
