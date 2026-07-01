# Hooks — Polypus

Hooks permitem que scripts shell sejam executados em pontos específicos do ciclo de vida do agente. O output de cada hook é injetado de volta no contexto do modelo — permitindo loops automáticos de lint, typecheck, testes e notificações sem intervenção manual.

## Configuração

Crie `.poly/hooks.json` na raiz do seu projeto (ou `~/.polypus/hooks.json` para configuração global):

```json
{
  "hooks": [
    {
      "event": "PostToolUse",
      "on": ["write_file", "edit_file"],
      "command": "npm run lint",
      "maxOutputChars": 1000
    }
  ]
}
```

> **Segurança:** hooks só são carregados de `~/.polypus/hooks.json` ou `.poly/hooks.json` do workspace — nunca de subdiretórios do repositório. Isso evita que projetos de terceiros injetem comandos maliciosos.

---

## Eventos

### `PreToolUse`

Executado **antes** de uma tool rodar. Se o script retornar exit code não-zero, a tool é **bloqueada** e o output é exibido ao modelo como motivo.

**Quando usar:**
- Validar argumentos antes de executar (ex.: bloquear `rm -rf`)
- Impor políticas de segurança por tipo de arquivo
- Garantir que o ambiente está pronto antes de escrever

**Exemplo — bloquear deleção de arquivos críticos:**
```json
{
  "event": "PreToolUse",
  "on": ["run_command"],
  "command": "echo \"$COMMAND\" | grep -q 'rm -rf' && exit 1 || exit 0"
}
```

**Substituições disponíveis:** `{tool}`, `{path}`, `{workspace}`

---

### `PostToolUse`

Executado **após** uma tool bem-sucedida. O stdout+stderr do script é injetado no resultado da tool — o modelo vê o output e pode corrigir erros automaticamente no próximo turno.

**Quando usar:**
- Rodar lint/typecheck após escrever ou editar arquivos
- Formatar código (prettier, gofmt, black)
- Verificar cobertura de testes após mudanças
- Gerar documentação automaticamente

**Exemplo — lint e typecheck após edição:**
```json
{
  "hooks": [
    {
      "event": "PostToolUse",
      "on": ["write_file", "edit_file"],
      "command": "npm run typecheck 2>&1 | tail -20",
      "maxOutputChars": 2000
    },
    {
      "event": "PostToolUse",
      "on": ["write_file", "edit_file"],
      "command": "npm run lint -- --fix {path} 2>&1",
      "maxOutputChars": 1000
    }
  ]
}
```

**Exemplo — rodar testes após mudança em arquivo específico:**
```json
{
  "event": "PostToolUse",
  "on": ["write_file"],
  "command": "npm test -- --testPathPattern={path} 2>&1 | tail -30",
  "maxOutputChars": 3000
}
```

**Substituições disponíveis:** `{tool}`, `{path}`, `{workspace}`

---

### `Stop`

Executado **quando o agente termina** (chama `finish`), após a verificação passar. Sem contexto de tool — use `{workspace}` para referenciar o diretório.

**Quando usar:**
- Fazer commit automático das mudanças
- Enviar notificação (Slack, email, webhook)
- Gerar changelog ou release notes
- Rodar suíte de testes completa ao final

**Exemplo — commit automático:**
```json
{
  "event": "Stop",
  "command": "cd {workspace} && git add -A && git diff --cached --quiet || git commit -m 'polypus: auto-commit'"
}
```

**Exemplo — notificação via webhook:**
```json
{
  "event": "Stop",
  "command": "curl -s -X POST $WEBHOOK_URL -d '{\"text\": \"Polypus terminou a tarefa\"}'"
}
```

**Substituições disponíveis:** `{workspace}`

---

## Referência de campos

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `event` | `"PreToolUse" \| "PostToolUse" \| "Stop"` | — | Quando o hook dispara |
| `on` | `string \| string[]` | `"*"` | Nome(s) de tool que ativam o hook. Não usado em `Stop`. Use `"*"` para qualquer tool |
| `command` | `string` | — | Comando shell. Suporta `{path}`, `{tool}`, `{workspace}` |
| `timeout` | `number` (ms) | `120000` | Tempo máximo de execução |
| `maxOutputChars` | `number` | `1000` | Máximo de chars capturados do stdout+stderr. Limite absoluto: 8000 |

---

## Substituições de variáveis

| Placeholder | Valor | Disponível em |
|-------------|-------|---------------|
| `{path}` | Caminho do arquivo sendo operado | `PreToolUse`, `PostToolUse` |
| `{tool}` | Nome da tool (ex.: `write_file`) | `PreToolUse`, `PostToolUse` |
| `{workspace}` | Diretório raiz do projeto | Todos |

---

## Comportamento de bloqueio e erros

- **`PreToolUse` com exit code != 0** → tool bloqueada; output vira mensagem de erro para o modelo
- **`PostToolUse` com exit code != 0** → output é injetado mesmo assim (o modelo vê o erro e corrige)
- **`Stop` com exit code != 0** → erro logado, mas o agente termina normalmente
- **Timeout** → hook interrompido, erro injetado no contexto
- **Script não encontrado** → erro injetado, execução continua

---

## Visibilidade no CLI e VSCode

Cada hook aparece na timeline de eventos com:
- Tipo do evento (`PreToolUse`, `PostToolUse`, `Stop`)
- Comando executado
- Tempo gasto (ex.: `1.2s`)
- Primeira linha do output (expandível)
- Status visual (✓ ok / ✗ erro)

No CLI, use `--compact` ou pressione `h` para colapsar os detalhes e ver só o resumo `(N eventos · Xs)`.

---

## Migração do formato antigo

Os campos `afterWrite`, `afterEdit`, `afterTool` e `beforeCommand` ainda funcionam mas estão deprecated. Uma mensagem de aviso é exibida no stderr ao carregar.

**Antes (deprecated):**
```json
{
  "afterWrite": "npm run lint",
  "afterEdit": "npm run lint",
  "beforeCommand": { "deny": ["rm -rf"] }
}
```

**Depois (recomendado):**
```json
{
  "hooks": [
    {
      "event": "PostToolUse",
      "on": ["write_file", "edit_file"],
      "command": "npm run lint"
    },
    {
      "event": "PreToolUse",
      "on": ["run_command"],
      "command": "echo \"{tool}\" | grep -qE 'rm -rf' && exit 1 || exit 0"
    }
  ]
}
```

---

## Exemplos completos

### Setup para projeto Node/TypeScript

```json
{
  "hooks": [
    {
      "event": "PostToolUse",
      "on": ["write_file", "edit_file"],
      "command": "npx tsc --noEmit 2>&1 | head -30",
      "maxOutputChars": 2000,
      "timeout": 30000
    },
    {
      "event": "PostToolUse",
      "on": ["write_file", "edit_file"],
      "command": "npx eslint {path} --fix 2>&1",
      "maxOutputChars": 1000
    },
    {
      "event": "Stop",
      "command": "cd {workspace} && git add -A && git diff --cached --quiet || git commit -m 'chore: polypus auto-commit'"
    }
  ]
}
```

### Setup para projeto Python

```json
{
  "hooks": [
    {
      "event": "PostToolUse",
      "on": ["write_file", "edit_file"],
      "command": "ruff check {path} --fix 2>&1",
      "maxOutputChars": 1000
    },
    {
      "event": "PostToolUse",
      "on": ["write_file"],
      "command": "python -m pytest tests/ -x -q 2>&1 | tail -20",
      "maxOutputChars": 2000,
      "timeout": 60000
    }
  ]
}
```
