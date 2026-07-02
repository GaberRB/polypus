# Tasks — Benchmark diagnóstico do Polypus

> **PRD de referência:** `prd-benchmark-diagnostico.md`
> **Escopo desta rodada:** ciclo 1 completo — infra do benchmark + run do ringue + trilha free + trilha stress + issues de gaps
> **Local do código:** `bench/` neste repo (Q3 do PRD, default aceito)
> **Branch sugerida:** `feat/bench-diagnostico`
> **Governança:** fora da pipeline issue-gated (decisão do dono registrada no PRD)

---

## 📊 Resumo Financeiro (estimativa)

| Item | Custo (USD) |
| :--- | :--- |
| Desenvolvimento (agentes com modelo free) | ~$0 |
| Run piloto (T11) | ~$1 |
| Run completo do ringue — DeepSeek V3 (T12) | $5–12 |
| Trilha free (T9) | $0 |
| **Teto total (kill-switch RNF2)** | **$15** |

---

## Plano de tarefas — benchmark diagnóstico

> Tarefas marcadas com ⛓️ têm dependência; as demais rodam em paralelo.
> Fronteiras: cada task cria arquivos em subpastas distintas de `bench/` — sem conflito de estado.

- [ ] **T1 — Preparar ambiente WSL2 com as 3 ferramentas pinadas**
  - Escopo: instalar OpenCode, Aider e Polypus em WSL2; 3 chaves OpenRouter separadas (uma por
    ferramenta, D3); config default de cada uma apontando pro DeepSeek V3; anotar versões exatas.
    Documentar em `bench/SETUP.md`.
  - Pronto: cada ferramenta resolve headless um exercício trivial ("hello world" do Exercism)
    via OpenRouter, comprovado por transcript salvo. (valida D1/D2)
  - Depende de: —

- [ ] **T2 — Selecionar e congelar o subset de exercícios (RF1)**
  - Escopo: `bench/tasks/` com 40-60 exercícios do polyglot (≥4 linguagens, distribuição de
    dificuldade preservada — Q1) + `manifest.json` (id, linguagem, dificuldade, cmd de teste)
    + calibração anti-flaky (testes rodam 2× sem agente; flaky = excluído com justificativa
    em `bench/tasks/EXCLUDED.md`). Marcar os ~15 da trilha free no manifest.
  - Pronto: manifest válido; `bench/scripts/calibrate.sh` passa 2× verde em todos os incluídos.
  - Depende de: —

- [ ] **T3 — Runner core + interface de adapter (RF2, CA4, CA6)**
  - Escopo: `bench/runner/` — orquestração de sessão: workspace descartável por sessão (RNF4),
    timeout configurável, retry/backoff para rate-limit (sessão vira `rate_limited`, nunca
    falha da ferramenta), gravação de `results.jsonl` (schema: task, tool, rep, verdict,
    motivo, tokens, custo, tempo), kill-switch de custo acumulado ≥ $15. Define a interface
    `ToolAdapter { prepare(ws), run(prompt, ws), collectMeta() }`.
  - Pronto: run com adapter fake grava linhas válidas em `results.jsonl`; timeout conta como
    falha `timeout`; teto de custo aborta preservando parciais (CA4, CA6 verificáveis com mock).
  - Depende de: —

- [ ] **T4 — Adapters: polypus, opencode, aider (RF2)**
  - Escopo: `bench/runner/adapters/{polypus,opencode,aider}.ts` — invocação headless com
    prompt idêntico (`polypus run`, `opencode run`, `aider --message`), env/flags de modelo
    e chave por ferramenta, captura de exit/artefatos. Três arquivos independentes —
    paralelizáveis entre si.
  - Pronto: CA1 — `runner --tool <X> --task <Y>` executa sessão real de ponta a ponta e grava
    a linha no `results.jsonl` para cada uma das 3 ferramentas.
  - Depende de: ⛓️ T1, T3

- [ ] **T5 — Coletor de usage do OpenRouter (RF5)**
  - Escopo: `bench/runner/usage.ts` — consulta a API de usage/generations do OpenRouter por
    chave dedicada, correlaciona com a janela de tempo da sessão, retorna tokens in/out e
    custo USD. Nunca lê auto-reporte das ferramentas.
  - Pronto: para uma sessão real, tokens reportados batem com o painel do OpenRouter (±0);
    sessões consecutivas não se contaminam.
  - Depende de: ⛓️ T1 (chaves)

- [ ] **T6 — Veredito objetivo + qualidade da entrega (RF3, RF10)**
  - Escopo: `bench/runner/verdict.ts` — roda o cmd de teste do manifest no workspace da sessão,
    normaliza passa/falha por linguagem, agrega maioria 2/3 entre reps (RF4). Qualidade:
    hash dos arquivos de teste antes/depois (modificado = `DESCLASSIFICADO`/`test_tampered`),
    LOC da solução e lista de arquivos tocados fora do esperado.
  - Pronto: exercício resolvido à mão → `pass`; workspace intocado → `fail`; teste adulterado
    → `DESCLASSIFICADO`; 2 de 3 reps passando → tarefa `pass`; LOC no results.jsonl.
  - Depende de: ⛓️ T2, T3

- [ ] **T7 — Gerador de relatório + veredito pré-registrado (RF6, CA2)**
  - Escopo: `bench/report/` — lê `results.jsonl`, produz `report.md` com acerto/tokens/custo/
    tempo por ferramenta, tabela por tarefa, lista de falhas; aplica automaticamente o critério
    do §2 do PRD (≥ melhor−3pp E ≤75% tokens) e imprime **publica/segura**. Reporta também
    pass@1 bruto (R1).
  - Pronto: CA2 verificável com um `results.jsonl` sintético cobrindo os dois vereditos.
  - Depende de: ⛓️ T3 (schema do jsonl)

- [ ] **T8 — Lockfile do experimento + doc de metodologia (RNF1, CA3, CA7)**
  - Escopo: `bench/EXPERIMENT.lock.json` (versões das 3 ferramentas, ID do modelo, temperatura,
    commit do snapshot/runner) + `bench/METHODOLOGY.md` (critério pré-registrado copiado do PRD,
    critério de seleção do subset, fairness RNF5). Runner recusa rodar sem lockfile válido.
  - Pronto: CA3 — re-invocação declara comparabilidade; CA7 — metodologia commitada antes do T12.
  - Depende de: ⛓️ T1, T2

- [ ] **T9 — Trilha free (RF7)**
  - Escopo: config `bench/configs/free.json` — 15 exercícios marcados no manifest × 1 rep ×
    3 ferramentas com `openai/gpt-oss-120b:free`; métricas de tempo suprimidas no relatório;
    backoff agressivo pra rate-limit.
  - Pronto: run free completa e `report.md` sai sem coluna de tempo, com comparação de
    degradação por ferramenta vs run DeepSeek.
  - Depende de: ⛓️ T4, T6, T7

- [ ] **T10 — Suíte de stress da trilha 2 (RF8, RF9, CA5)**
  - Escopo: `bench/stress/` — 10-15 tarefas sobre o repo real do polypus (contexto enorme,
    refactor multi-arquivo, tarefa ambígua, teste vermelho de primeira, sessão longa com
    checkpoint/rewind, interrupção+resume) + harness que roda **no Windows nativo** e grava
    registro estruturado por falha (tarefa, sintoma, transcript, tokens) em
    `bench/stress/findings/`. Independente do ringue — só usa o polypus.
  - Pronto: CA5 — uma falha induzida gera finding completo suficiente pra abrir issue sem
    re-investigação.
  - Depende de: — (paralela a tudo; não usa o runner do ringue)

- [ ] **T11 — Run piloto (smoke do pipeline)**
  - Escopo: 5 exercícios × 3 ferramentas × 1 rep com DeepSeek; validar ponta a ponta: adapters,
    usage, veredito, jsonl, custo (~$1). Ajustar timeouts/prompts do runner com o que aparecer.
  - Pronto: `report.md` do piloto gerado sem intervenção manual; custo real registrado.
  - Depende de: ⛓️ T4, T5, T6, T7, T8

- [ ] **T12 — Run completo do ringue + veredito + issues de gaps**
  - Escopo: subset completo × 3 ferramentas × 3 reps; gerar relatório final; aplicar critério
    pré-registrado; **para cada gap** (tarefa onde Polypus falhou e concorrente passou, ou
    consumo de tokens anômalo): abrir issue com o finding anexado. Resultado ruim não é
    descartado (§2 do PRD).
  - Pronto: relatório final commitado em `bench/results/ciclo-1/`; veredito publica/segura
    explícito; 1 issue por gap aberta.
  - Depende de: ⛓️ T11

### Caminho crítico
T1/T3 → T4 → T11 → T12 (T2, T5, T6, T7, T8 correm em paralelo nos vãos; T9 e T10 fora do
caminho crítico — T10 pode começar hoje).

### Questões em aberto herdadas do PRD
- Q1 (lista exata do subset) — resolvida dentro da T2, dono valida o manifest.
- Q2 (Goose como 4ª ferramenta) — fora desta rodada; entraria como novo adapter na T4.
