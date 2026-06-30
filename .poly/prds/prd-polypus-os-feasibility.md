# PRD / Estudo de Viabilidade — Polypus OS

| | |
|---|---|
| **Versão** | 0.1 (feasibility / go-no-go) |
| **Autor** | Gabriel Rios Belmiro |
| **Derivado de** | "PRD Polypus OS 1.0" (visão original) |
| **Status** | Em validação de engenharia |
| **Tipo de doc** | Estudo de viabilidade — veredito ✓/⚠/✗ por componente + POCs |

**Decisões travadas nesta rodada** (definem o escopo deste documento):

1. **Runtime alvo:** Docker local (dev) primeiro. k8s/EKS é horizonte futuro.
2. **Posição:** Polypus OS é um **produto novo** que **reusa o harness atual** (`@gaberrb/polypus`) como camada cognitiva ("cérebro"). Não pivota nem quebra o CLI/desktop existentes.
3. **Altitude:** Estudo de viabilidade / go-no-go. Não é spec de implementação fechada.
4. **SaaS/GitOps:** **Fora de escopo agora.** MVP é 100% local — diagnóstico + relatórios + aprovação no terminal. Dashboard e auto-PR ficam como fase futura.

---

## 0. TL;DR — Recomendação go/no-go

**Veredito: GO condicional para um MVP local de prova-de-conceito.** O ciclo central — *observar → detectar anomalia localmente → consolidar contexto → acionar a IA → propor/aplicar correção sob política de permissão* — é **factível e reaproveita ~60% do que o Polypus já tem**. Três pilares do PRD original precisam ser **reescopados ou rebaixados** porque, como descritos, esbarram em limites físicos de containers.

| Pilar do PRD original | Veredito | Resumo |
|---|---|---|
| Inicializador PID 1 (`tini`/`supervisord`) | ✅ | Padrão de mercado, trivial. |
| Banco vetorial (SQLite + `sqlite-vec`) | ✅ | Viável; harness já persiste sessões em arquivo. |
| Camada cognitiva (LLM via OpenRouter) | ✅ | **Já existe** no harness. |
| Modos de segurança (Review/Read-only/Bypass) | ✅ | **Já existem** como `review`/`plan`/`bypass`. |
| Coletor `/proc` + cgroup stats | ✅ | Caminho de menor risco para o MVP. |
| Coletor eBPF | ⚠️ | Funciona local com container privilegiado, mas é pesado e dependente de kernel. Tratar como *enhancement*, não como base do MVP. |
| Camada de ML local | ⚠️ | Detecção de anomalia leve é factível. **"SHAP" especificamente parece overengineering** — ver §5. |
| Isolador `cgroups`/`nice` (reservar CPU pro daemon) | ⚠️/❌ | **Não funciona como descrito** de dentro de um único container. Exige padrão sidecar ou cgroup v2 delegado. |
| "Hotfix imediato em produção" | ❌/⚠️ | **Equívoco conceitual central.** Editar arquivo num container em execução **não persiste** e, em linguagens compiladas, **não tem efeito**. O fix durável é o **PR**, não a edição no container. Ver §5. |
| Dashboard SaaS + GitOps | ⏸️ | Fora de escopo nesta rodada (decisão #4). |

**Condição do GO:** aceitar que a entrega de valor real é **"diagnóstico explicável + correção via PR"**, e que a "auto-cura em runtime" é, no máximo, uma **mitigação temporária e best-effort** para um subconjunto estreito de casos (apps interpretadas, com código-fonte presente e hot-reload).

---

## 1. Problema / Contexto

Times que rodam serviços em container percebem gargalos (CPU/RAM/latência/erros) **tarde**, via dashboards passivos, e gastam horas correlacionando métrica de infra com a linha de código culpada. Ferramentas de APM mostram *que* algo degradou, mas não *por quê no código* nem entregam a correção. A dor: o loop "alerta → humano investiga → humano corrige → humano abre PR" é lento e caro.

**Por que agora:** o Polypus já é um harness agêntico capaz de ler um repositório, propor patch e operar sob modos de permissão. Falta apenas a "ponta sensorial" (observabilidade + filtro estatístico) para transformá-lo de *assistente sob demanda* em *agente reativo a sinais de runtime*.

## 2. Objetivo & métrica de sucesso (do MVP de viabilidade)

**Objetivo:** provar, num único container Docker local, o loop ponta-a-ponta: anomalia injetada → detectada localmente → contexto consolidado (poucos KB) → IA gera diagnóstico + patch → patch entra no fluxo de permissão.

**Métricas observáveis (de-risking, não de produto):**

- **M1 — Eficiência de filtragem:** a IA é acionada em **≤ 1 vez por anomalia real**; ruído normal **não** dispara chamada de LLM. Alvo: payload enviado à nuvem **< 8 KB** por evento.
- **M2 — Latência de detecção:** da injeção da anomalia ao diagnóstico estruturado em disco **< 30 s** (p95) no caminho `/proc`.
- **M3 — Precisão mínima:** num set de ≥ 5 anomalias sintéticas (busy-loop, vazamento de memória, fan-out de I/O, exception loop, latência de dependência), **≥ 3** geram diagnóstico apontando o sintoma correto.
- **M4 — Custo de overhead:** daemon ocioso consome **< 5% CPU** e **< 150 MB RAM** no baseline.

## 3. Escopo desta rodada

Ver "Decisões travadas" no topo. Em uma linha: **container Docker single-node, harness como cérebro, feasibility study, sem nuvem.**

## 4. Arquitetura proposta (reescopada)

```
┌──────────────────────── Container Polypus OS (imagem base) ─────────────────────────┐
│                                                                                      │
│  PID 1: tini ──┬── inicia daemon Polypus (background, nice +10)                       │
│                └── exec da APP do usuário (CMD herdado)                               │
│                                                                                      │
│  ┌─ Camada 1: Coletor ──────────┐   amostra a cada N ms                              │
│  │  /proc + cgroup v2 stats      │   (eBPF = enhancement opt-in, container privileg.)│
│  └──────────────┬───────────────┘                                                    │
│                 │ séries temporais cruas                                              │
│  ┌─ Camada 2: Analyzer (Python) ┐   z-score/EWMA/IsolationForest                     │
│  │  detecção de anomalia +       │   "feature attribution" (SHAP opcional) → sinal   │
│  │  consolidação de contexto     │   explicável + janela de código suspeita          │
│  └──────────────┬───────────────┘                                                    │
│                 │ payload consolidado (< 8 KB) SE anomalia                            │
│  ┌─ Camada 3: Cérebro (harness) ┐   @gaberrb/polypus                                 │
│  │  diagnóstico + patch + report │   modos: plan | review | bypass                   │
│  └──────────────┬───────────────┘                                                    │
│                 │                                                                     │
│  ┌─ Persistência ───────────────┐   SQLite (+ sqlite-vec p/ histórico semântico)     │
│  │  /var/log/polypus/diagnostics │   relatórios Markdown/JSON                         │
│  └──────────────────────────────┘                                                    │
└──────────────────────────────────────────────────────────────────────────────────────┘
                 (Fase futura: WebSocket → Dashboard SaaS → auto-PR)
```

**Reaproveitamento do harness (`@gaberrb/polypus`):**

- A **Camada 3** chama o harness. Hoje o pacote expõe `@gaberrb/polypus/lib` com `chatOnce`, sessões e config — **mas o loop agêntico completo (tool-runner, apply-patch, git) ainda é interno.** Integração possível por dois caminhos: (a) **shell-out** para a CLI (`polypus run --mode review ...`), caminho mais rápido pro MVP; (b) **estender o lib export** para expor o loop in-process. Recomendo (a) no MVP, (b) depois.
- **Modos de permissão já implementados** (`src/core/permissions/modes.ts`): `plan` nega escritas/comandos, `review` pergunta por ação (com aprovação hunk-a-hunk), `bypass` libera **mas ainda bloqueia comandos destrutivos e segredos hardcoded em qualquer modo**. Isso é exatamente a base de segurança que um agente com autonomia em runtime precisa.

## 5. Análise de viabilidade por componente

### 5.1 Inicializador PID 1 — ✅ Factível
`tini` como PID 1 repassa sinais (SIGTERM/SIGKILL) e faz reaping de zumbis. Inicia o daemon em background e dá `exec` na app do usuário. `supervisord` é alternativa se precisarmos de restart-policy interno, mas adiciona peso. **Default: `tini` + um pequeno script de entrypoint.** Risco baixo.

### 5.2 Coletor `/proc` + cgroup v2 — ✅ Factível (caminho do MVP)
Ler `/proc/[pid]/stat`, `/proc/[pid]/io`, `/sys/fs/cgroup/*` dá CPU, RAM, I/O e throttling **sem privilégio especial e sem dependência de kernel exótico**. É o coletor que sustenta M1–M4. **Esta é a base recomendada do MVP.**

### 5.3 Coletor eBPF — ⚠️ Factível com ressalvas (enhancement)
- No Docker Desktop (Windows/WSL2 e macOS) o container roda numa **VM Linux**; o eBPF observa o kernel **dessa VM**, não do host — o que é aceitável, pois queremos observar a app *dentro* do container.
- Exige `--privileged` ou `CAP_BPF`+`CAP_SYS_ADMIN`, kernel com BTF/CO-RE, e libs (libbpf/bcc) que incham a imagem.
- **Veredito:** poderoso, mas **não deve ser pré-requisito do MVP**. Entra como coletor opt-in com *capability detection* em runtime (se não houver eBPF, cai pro `/proc`).

### 5.4 Analyzer ML local — ⚠️ Factível, mas repensar "SHAP"
- Detecção de anomalia leve (z-score, EWMA, IsolationForest) roda em Python tranquilamente — e o harness **já tem a tool `run-python-script`**, então há trilho pronto.
- **Ponto crítico — SHAP:** SHAP explica a contribuição de *features* na predição de um **modelo de ML**. Para detectores estatísticos simples **não há "modelo" a explicar**, e SHAP por evento em tempo real é **caro**. A *intenção* (mandar à nuvem um sinal explicável e compacto, não a métrica crua) é ótima; o *meio* "SHAP" provavelmente é overengineering para o MVP.
- **Proposta:** chamar a Camada 2 de **"atribuição de sinal"**. MVP usa atribuição leve (qual métrica/quanto desviou + janela temporal). SHAP fica como opção *se* adotarmos IsolationForest/árvore e o valor de explicabilidade justificar o custo. **Manter a porta aberta, não fechar no MVP.**

### 5.5 SQLite + `sqlite-vec` — ✅ Factível
Arquivo único em disco para histórico de diagnósticos e embeddings de problemas (busca semântica de "já vimos isso antes"). O harness já persiste sessões em arquivo, então o padrão é conhecido. `sqlite-vec` é embarcável. Risco baixo. **Aberto:** retenção/rotação do arquivo (ver Q).

### 5.6 Camada cognitiva (LLM) — ✅ Já existe
Providers (OpenRouter/Ollama/Anthropic/OpenAI-compat), injeção de chave por env var, e o protocolo de tool-calling (nativo **ou** emulado por XML para modelos sem function-calling). **Zero trabalho novo de fundação aqui** — só a "cola" do payload consolidado → prompt.

### 5.7 Modos de segurança — ✅ Já existem
`plan` ≈ **Só-Leitura/Auditoria**, `review` ≈ **Review (Y/N)**, `bypass` ≈ **Piloto Automático**. E o `bypass` **ainda bloqueia** comandos destrutivos e gravação de segredos — exatamente o guard-rail que o "Modo Bypass em produção" do PRD exige. **Aproveitamento direto.**

### 5.8 Isolador `cgroups`/`nice` — ⚠️/❌ Como descrito, não funciona
- "Reservar 10% de CPU pro daemon" **de dentro do mesmo container** não é trivial: a cota total do container é definida **externamente** (`docker --cpus`, k8s requests), não por um processo que se auto-isola. `nice` muda **prioridade de escalonamento**, não **reserva** capacidade.
- **Sub-cgroups internos** exigem cgroup v2 **delegado** ao container — frequentemente indisponível.
- **Caminho realista:** rodar daemon e app em **containers separados num mesmo pod (sidecar)**, deixando o orquestrador impor o isolamento. Mas isso **quebra o modelo "uma imagem base que envolve a app"**.
- **MVP:** usar `nice +10` (best-effort, baixa prioridade) e **não prometer reserva garantida**. Reserva real é uma decisão de arquitetura aberta (ver Q).

### 5.9 "Hotfix imediato em produção" — ❌/⚠️ O maior equívoco a corrigir
Este é o ponto que mais precisa de honestidade de engenharia:

- Editar um arquivo num container **em execução** grava na **camada de escrita efêmera**: **some no restart/redeploy** e **não altera a imagem**.
- Em linguagens **compiladas** (Go, Java, Rust, C#…), editar o fonte **não tem efeito** sem rebuild/restart.
- Em linguagens **interpretadas** (Python, Node, Ruby), só surte efeito se houver **hot-reload** e o **código-fonte estiver presente** no container — o que **imagens de produção normalmente não têm** (shipam build/artefato, não `src/`).
- **Reframe obrigatório:** o **fix durável é o PR** (GitOps). A "edição no container" é, no melhor caso, uma **mitigação temporária, best-effort e não-persistente** para um nicho (app interpretada + fonte presente + hot-reload). Vender isso como "auto-cura em produção" universal é incorreto.
- **MVP:** **não** aplica em produção. Gera **diagnóstico + patch proposto** e respeita o modo de permissão. A persistência real vira o **PR da fase futura**.

### 5.10 Dashboard SaaS + GitOps — ⏸️ Fora de escopo
Decisão #4. No MVP a "aprovação" é no TTY (Y/N do `review`) e o "output" são relatórios em `/var/log/polypus/diagnostics/`. WebSocket/gRPC, dashboard e auto-PR ficam para depois — mas a arquitetura acima já deixa o ponto de extensão (saída da Camada 3) preparado.

## 6. Requisitos

### Funcionais (o que o MVP FAZ)
- **RF1** — Iniciar como PID 1 (`tini`), subir o daemon em background e dar `exec` na app do usuário, repassando sinais corretamente.
- **RF2** — Coletar CPU/RAM/I-O da app via `/proc` + cgroup v2 em intervalo configurável (default 1 s).
- **RF3** — Detectar anomalia localmente (z-score/EWMA/IsolationForest) **sem** acionar a nuvem em condição normal.
- **RF4** — Ao detectar anomalia, montar um payload consolidado (< 8 KB) com: métrica desviada, magnitude, janela temporal e (se disponível) janela de código/log correlata.
- **RF5** — Acionar o cérebro (harness) com esse payload e obter **diagnóstico estruturado + patch proposto**.
- **RF6** — Persistir diagnóstico em `/var/log/polypus/diagnostics/` em **Markdown e JSON**, e indexá-lo em SQLite (+ embedding via `sqlite-vec`).
- **RF7** — Respeitar o modo de permissão ativo: `plan` (só relatório), `review` (pede Y/N), `bypass` (aplica localmente — best-effort, **não em prod** no MVP).
- **RF8** — Injetar config/segredos exclusivamente por **variável de ambiente** (`OPENROUTER_API_KEY`, `POLYPUS_MODEL`, modo, intervalo…). Nada hardcoded na imagem.

### Não-funcionais (como ele se comporta)
- **RNF1 — Overhead:** daemon ocioso < 5% CPU / < 150 MB RAM (M4).
- **RNF2 — Filtragem:** ≥ 95% das amostras normais **não** geram chamada de LLM (M1).
- **RNF3 — Robustez:** crash do daemon **nunca** derruba a app do usuário (processos independentes; app é o processo "principal").
- **RNF4 — Portabilidade:** rodar em Docker Desktop (WSL2/macOS) e Docker nativo Linux **sem** exigir eBPF.
- **RNF5 — Segurança:** segredos nunca em log/relatório; scanner de segredos do harness ativo; comandos destrutivos bloqueados em todos os modos.
- **RNF6 — Observabilidade do próprio Polypus:** o daemon loga suas próprias decisões (por que acionou/não acionou a IA) para auditoria.

## 7. Fora de escopo (explícito)

- ❌ Dashboard SaaS, WebSocket/gRPC, multi-tenancy.
- ❌ Abertura automática de PR (GitHub/GitLab).
- ❌ Aplicação de hotfix em ambiente **de produção**.
- ❌ eBPF como requisito (entra só como enhancement opt-in).
- ❌ Reserva **garantida** de CPU/RAM via cgroups internos.
- ❌ Kubernetes/EKS/ECS (horizonte futuro; MVP é Docker single-node).
- ❌ Treino de modelos de ML pesados; só estatística/IsolationForest leve.

## 8. Dependências & riscos

| # | Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|---|
| R1 | "Hotfix em runtime" não persiste / sem efeito em compiladas | Alta | Alto | Reframe: fix real = PR; runtime = mitigação best-effort. |
| R2 | eBPF indisponível/instável no ambiente do dev | Média | Médio | Coletor `/proc` como default; eBPF opt-in com fallback. |
| R3 | Loop agêntico do harness não exposto via lib | Alta | Médio | MVP faz shell-out p/ CLI; expor lib depois. |
| R4 | SHAP/ML caro ou de baixo valor no MVP | Média | Médio | Começar com atribuição estatística leve; SHAP opcional. |
| R5 | Falsos positivos disparando LLM (custo de token) | Média | Alto | Thresholds + janela de confirmação + dedupe por hash de anomalia. |
| R6 | Imagem de prod sem `src/` → cérebro sem contexto de código | Alta | Alto | Exigir fonte montado/presente para o modo de patch; senão, só diagnóstico. |
| R7 | Agente com `bypass` + autonomia = blast radius | Média | Alto | Default `review`; `bypass` exige opt-in explícito; comandos destrutivos sempre bloqueados. |
| R8 | Custo de OpenRouter sem teto | Média | Médio | Orçamento de tokens/hora por container; circuit-breaker. |

## 9. POCs necessárias (ordem de de-risking)

1. **POC-A (sinaliza GO/NO-GO do loop):** entrypoint `tini` + daemon `/proc` + detector z-score + injetar um busy-loop sintético → gerar JSON de anomalia em `/var/log`. *Sucesso:* M2 (< 30 s) e M4 (overhead) atingidos. **Sem LLM ainda.**
2. **POC-B (a cola com o cérebro):** payload consolidado da POC-A → `polypus run --mode plan` → diagnóstico Markdown salvo. *Sucesso:* M3 (≥ 3/5 anomalias diagnosticadas) e M1 (< 8 KB, 1 chamada/anomalia).
3. **POC-C (correção sob política):** modo `review` propõe patch num app Node de exemplo (com fonte presente) e aplica após Y. *Sucesso:* patch aplicado localmente + relatório retroativo; `plan` não altera nada.
4. **POC-D (memória):** SQLite + `sqlite-vec` recupera diagnóstico anterior similar antes de chamar a IA (cache semântico). *Sucesso:* anomalia repetida resolvida **sem** nova chamada de LLM.

> eBPF, cgroup-reserva, SaaS e auto-PR **não** têm POC nesta rodada — são pós-GO.

## 10. Critérios de aceite (testáveis)

- [ ] **CA1** — Dado um container Polypus OS, quando a app recebe SIGTERM, então tini repassa o sinal e a app encerra graciosamente (daemon não interfere).
- [ ] **CA2** — Dado o daemon ocioso por 5 min, então CPU média < 5% e RSS < 150 MB.
- [ ] **CA3** — Dado tráfego normal sintético por 5 min, então **0** chamadas de LLM são feitas.
- [ ] **CA4** — Dada uma anomalia de CPU injetada, quando detectada, então um diagnóstico JSON+MD aparece em `/var/log/polypus/diagnostics/` em < 30 s.
- [ ] **CA5** — Dado o payload de anomalia, então o tamanho enviado ao provider é < 8 KB.
- [ ] **CA6** — Num set de 5 anomalias sintéticas, então ≥ 3 diagnósticos apontam o sintoma correto.
- [ ] **CA7** — Em modo `plan`, dado qualquer diagnóstico, então **nenhum** arquivo da app é modificado.
- [ ] **CA8** — Em modo `review`, dado um patch proposto, então nada é aplicado sem confirmação Y.
- [ ] **CA9** — Dado um segredo no contexto, então ele **não** aparece em nenhum relatório nem log.
- [ ] **CA10** — Dada uma anomalia idêntica a uma já diagnosticada, então a resposta vem do cache semântico **sem** nova chamada de LLM.

## 11. Questões em aberto (gaps)

- **Q1 — Linguagens-alvo do "patch em runtime".** Só interpretadas com hot-reload, ou também propor patch (sem aplicar) para compiladas? *(decide: produto)*
- **Q2 — Origem do código-fonte.** O container terá `src/` montado/presente? Sem isso o cérebro só diagnostica, não corrige. Volume montado? Clone do repo no boot? *(decide: produto + infra)*
- **Q3 — Reserva de recursos.** Aceitamos `nice` best-effort no MVP, ou a reserva garantida (sidecar/cgroup delegado) é requisito de produto? *(decide: arquitetura)*
- **Q4 — SHAP sim ou não.** Vale o custo de explicabilidade formal, ou atribuição estatística leve basta? Depende de quão "auditável" o diagnóstico precisa ser. *(decide: produto)*
- **Q5 — Integração com o harness.** Shell-out (rápido) vs. estender `@gaberrb/polypus/lib` para expor o loop in-process (mais limpo). Quando migrar? *(decide: engenharia)*
- **Q6 — Orçamento de tokens.** Teto por container/hora? Circuit-breaker em qual limite? *(decide: produto)*
- **Q7 — Classes de anomalia do MVP.** CPU/RAM/I-O são óbvias; latência e taxa de erro exigem instrumentar a app (a Camada 1 vê syscalls/recursos, não "HTTP 500"). Entram no MVP? *(decide: produto)*
- **Q8 — Retenção do SQLite.** Rotação/limite de tamanho do banco e dos relatórios em `/var/log`. *(decide: engenharia)*
- **Q9 — Identidade/permissão Git (fase futura).** Quando o GitOps entrar: token de bot, qual escopo, qual repo/branch? *(decide: produto + segurança)*

## 12. Roadmap sugerido

- **Fase 0 — De-risking (este doc):** POC-A → POC-D. Saída: GO/NO-GO informado por dados.
- **Fase 1 — MVP local:** RF1–RF8 num container Docker, modo `review` default, relatórios + cache semântico. Sem nuvem.
- **Fase 2 — Robustez & eBPF opt-in:** coletor eBPF com fallback, mais classes de anomalia, orçamento de tokens.
- **Fase 3 — Nuvem & GitOps:** WebSocket → Dashboard SaaS → aprovação remota → **auto-PR** (a persistência durável real). k8s/EKS, sidecar p/ isolamento garantido.

---

> **Próximo passo sugerido:** quebrar a **Fase 0 (POC-A → POC-D)** em tarefas paralelizáveis com a skill `generate-tasks`, começando pela POC-A (que sozinha já valida o maior risco de overhead/latência sem gastar 1 token de LLM).
