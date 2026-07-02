# bench/demo — head-to-head rápido (Polypus × OpenCode × Aider)

Demo gravável do benchmark: as três ferramentas resolvem as **mesmas tarefas** com o
**mesmo modelo** (`deepseek/deepseek-chat-v3-0324` via OpenRouter), e o veredito é
objetivo (`node --test` no final de cada sessão).

> Este é o **demo** (T1 do plano). O ringue formal com 40-60 exercícios, 3 reps e
> medição de tokens pela API do OpenRouter é o runner de `tasks-benchmark-diagnostico.md`.

## Pré-requisitos (já feitos pelo setup)

- `npm run build` na raiz (polypus em `dist/index.js`)
- `npm i -g opencode-ai` · `uv tool install --python 3.12 aider-chat`
- Agente do polypus: `polypus add-agent bench-deepseek --provider openrouter --model deepseek/deepseek-chat-v3-0324 --api-key "\${OPENROUTER_API_KEY}" --tool-mode emulated`
  — **emulated de propósito**: o roteamento do OpenRouter varia de provider upstream e alguns
  param de emitir tool calls nativas (issue #208); o modo emulado é imune e gastou ~60% menos
  tokens no teste (9,6k vs 25k na mesma tarefa).
- `bench/demo/.env` com `OPENROUTER_API_KEY` (arquivo gitignored; **rotacione a chave após o teste**)

## Como rodar

```powershell
cd bench\demo
.\run-all.ps1              # as 3 ferramentas, em sequência, nas 2 tarefas
.\run-tool.ps1 -Tool polypus            # só uma ferramenta
.\run-tool.ps1 -Tool aider -Tasks leap  # uma ferramenta, uma tarefa
```

Cada sessão roda num workspace descartável em `runs/<timestamp>-<tool>/<task>/`.
O placar acumulado fica em `runs/results.csv` (`tool,task,verdict,seconds,loc`).

**Métricas:**
- **Veredito** — `node --test` (PASS/FAIL). Se a ferramenta modificar `solution.test.mjs`,
  o veredito vira `DESCLASSIFICADO` (checagem por hash antes/depois).
- **LOC** — linhas de código da solução entregue (concisão).
- **Custo por ferramenta** — cada ferramenta usa **sua própria chave** OpenRouter;
  `.\show-costs.ps1` mostra o gasto acumulado por chave direto da API (fonte neutra).
  O OpenRouter contabiliza com atraso de alguns minutos — rode no fim da gravação.
  O `run-all.ps1` já chama isso automaticamente no final.
- **Tokens** — polypus e aider imprimem no fim de cada sessão; o opencode não imprime no
  modo `run`, então o script chama `opencode stats` após as sessões dele.

> ⚠️ **Rode num terminal de verdade** (Windows Terminal/PowerShell aberto na tela — que é o
> caso da gravação). O `opencode run` trava se o stdout for redirecionado/capturado sem TTY
> (bug conhecido do OpenCode no Windows); com console real funciona normal (validado).

## Tarefas

| Tarefa | O quê | Dificuldade |
|--------|-------|-------------|
| `leap` | ano bissexto (`isLeap`) | fácil |
| `rle`  | run-length encoding (`encode`/`decode`) | média |

Cada tarefa = `PROMPT.md` (instrução idêntica pras 3 ferramentas) + `solution.mjs` (stub)
+ `solution.test.mjs` (testes imutáveis, rodados com `node --test`).
