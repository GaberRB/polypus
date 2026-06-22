# skill: task-generation

Quebrar um PRD em tarefas desacopladas e paralelizáveis, documentando o progresso no PR.

## Princípios

- **Desacoplamento:** Cada tarefa deve ser independente das outras, permitindo execução paralela.
- **Transparência:** Documente o modelo de LLM usado, tokens consumidos e custo em dólares por tarefa.
- **Checklist:** No PR, inclua um checklist de progresso das tarefas.

## Fluxo

1. **Obter o PRD:** Use o comentário gerado pelo `prd-bot.yml` na issue.
2. **Gerar tarefas:** Divida o PRD em tarefas independentes usando um modelo de LLM.
3. **Documentar no PR:** Adicione um cabeçalho com o resumo financeiro e o checklist de tarefas.

## Exemplo de Saída no PR

```markdown
## 🤖 Agent Execution Dashboard

### 📊 Financial & LLM Metrics Summary
| Total Cost (USD) | Total Tokens Used | Default Model |
| :--- | :--- | :--- |
| **$0.421** | 28,500 | `claude-3-5-sonnet` |

---

### 📋 Task Execution Progress
> ⚠️ **Architecture Note:** As tarefas abaixo foram desacopladas e isoladas para permitir execução paralela/concorrente entre agentes, mitigando conflitos de estado.

- [x] **Task 01: Implementar Camada de Cache Redis para Endpoints de Busca**
  * **Model:** `claude-3-5-sonnet`
  * **Usage:** 8,500 tokens
  * **Cost:** $0.127
- [x] **Task 02: Criar Validação de Payload e Schemas com Joi/Zod**
  * **Model:** `gpt-4o-mini`
  * **Usage:** 12,000 tokens
  * **Cost:** $0.084
- [x] **Task 03: Escrever Testes de Carga de Integração (k6/Artillery)**
  * **Model:** `claude-3-5-sonnet`
  * **Usage:** 8,000 tokens (estimated)
  * **Cost:** $0.210 (in progress)

---
## 📝 Original PRD Reference
<!-- Link ou sumário do comentário do PRD original para tracking -->
```

## Implementação em Código

- **Classe/Tool:** `task-generator.ts` (em `src/core/agent/`).
- **Chamada:** Executada automaticamente ao rotular a issue como `accepted`.
- **Configuração:** Registre o modelo padrão e os tokens estimados por tarefa no `context.md`.

## Testes

- Consuma uma issue de exemplo e valide a saída das tarefas.
- Verifique se as tarefas são independentes e paralelizáveis.
