/** Minimal zero-dependency i18n. Default locale is pt-BR; English is available. */

export const LOCALES = ["pt-BR", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "pt-BR";

/** Human-readable names used by the agent prompt and the wizard. */
export const LOCALE_NAMES: Record<Locale, string> = {
  "pt-BR": "Português (Brasil)",
  en: "English",
};

type Catalog = Record<string, string>;

const en: Catalog = {
  // generic
  "common.default": "default",
  "common.keySet": "key set",
  "common.noKey": "no key",

  // cli descriptions
  "cli.description":
    "Agentic coding harness that makes any AI API generate and apply code — OpenRouter, Ollama, and any OpenAI-compatible endpoint.",
  "cli.opt.lang": "interface language: pt-BR | en",
  "cli.cmd.setup": "Interactive setup wizard (configure agents, keys, permissions)",
  "cli.cmd.init": "Scaffold a .poly/ workspace (agents.md, skills, SDD spec template, README)",
  "cli.opt.force": "overwrite files that already exist",
  "cli.cmd.addAgent": "Register a new agent (API key + model)",
  "cli.cmd.removeAgent": "Remove a configured agent",
  "cli.cmd.listAgents": "List configured agents",
  "cli.cmd.run": "Run a coding task with an agent",
  "cli.cmd.swarm":
    "Split a task across multiple agents working in parallel git worktrees (requires 3+ configured agents)",
  "cli.cmd.models": "Browse OpenRouter models (price, context, tool support)",
  "cli.cmd.prd": "Generate a PRD from a GitHub issue (uses a free OpenRouter model)",
  "cli.arg.prdIssue": "issue number to turn into a PRD",
  "cli.cmd.review": "Review a pull request diff (uses a free OpenRouter model)",
  "cli.arg.reviewPr": "pull request number to review",
  "cli.opt.out": "write output to this file instead of stdout",
  "cli.opt.input": 'read input from a file (or "-" for stdin) instead of calling gh',
  "prd.wrote": "✓ PRD written to {path}",
  "review.wrote": "✓ Review written to {path}",
  "cli.invalidRef": "Invalid number '{ref}': expected a numeric issue/PR number.",
  "cli.stdinTty": "--input - expects piped stdin, but none was provided.",
  "cli.opt.search": "filter by id/name substring",
  "cli.opt.toolsOnly": "only models that support tool-calling",
  "cli.opt.free": "only free models",
  "cli.opt.maxPrice": "max prompt price (USD per 1M tokens)",
  "cli.opt.sort": "price | price-desc | context | name",
  "cli.opt.limit": "max rows to show",
  "cli.arg.addAgentName": "unique name for the agent",
  "cli.opt.provider": "openrouter | ollama | openai-compatible | anthropic",
  "cli.opt.model": "model id, e.g. anthropic/claude-3.5-sonnet or llama3.1",
  "cli.opt.apiKey": 'API key or env reference like "${OPENROUTER_API_KEY}"',
  "cli.opt.baseUrl": "override the provider base URL",
  "cli.opt.toolMode": "auto | native | emulated",
  "cli.opt.setDefault": "make this the default agent",
  "cli.arg.removeAgentName": "name of the agent to remove",
  "cli.arg.runTask": "task for the agent; omit to start an interactive session",
  "cli.opt.agent": "which configured agent to use",
  "cli.opt.mode": "plan | review | bypass (overrides config)",
  "cli.opt.maxSteps": "maximum agent steps",
  "cli.opt.json": "headless mode: emit a single JSON object (steps, tool calls, files changed, usage) instead of the TUI — use with --mode bypass",
  "cli.opt.verify": "after the agent finishes, run project checks (typecheck/build/test) and iterate until they pass",
  "cli.opt.budget": "stop the run when the estimated session cost reaches this USD amount (OpenRouter pricing)",
  "cli.cmd.usage": "Show token/cost analytics aggregated per day",
  "cli.cmd.sessions": "List saved sessions that can be resumed",
  "cli.opt.continue": "resume the most recent saved session",
  "cli.opt.resume": "resume a specific saved session by id",
  "cli.arg.swarmTask": "high-level task to split across agents",
  "cli.opt.agents": "comma-separated agent names (default: all configured)",
  "cli.opt.maxSubtasks": "maximum number of parallel subtasks",

  // agents
  "agent.exists": 'An agent named "{name}" already exists. Use remove-agent first to replace it.',
  "agent.needBaseUrl": 'Provider "{provider}" requires --base-url.',
  "agent.needApiKey":
    'Provider "{provider}" requires an API key. Pass --api-key "${ENV_VAR}" (recommended) or a literal value.',
  "agent.added": "✓ Added agent {name}",
  "agent.removed": "✓ Removed agent {name}",
  "agent.notFound": 'No agent named "{name}".',
  "agent.none": "No agents configured. Run `polypus setup` or `polypus add-agent`.",
  "agent.listHeader": "Agents:",
  "agent.permLine": "Permissions: mode={mode}, allow=[{allow}]",
  "agent.noneKnown": 'No agent named "{name}". Known agents: {names}',
  "agent.needAnthropicKey": 'Agent "{name}" (anthropic) requires an API key.',
  "agent.noBaseUrl": 'Agent "{name}" has no base URL configured.',
  "agent.noneConfigured": "No agents configured. Run `polypus setup` or `polypus add-agent` first.",
  "agent.multipleNoDefault":
    "Multiple agents configured but no default set. Pass --agent <name> or set a default. Agents: {names}",

  // run / loop
  "run.status":
    "agent={name} provider={provider} model={model} tool-mode={toolMode} permission-mode={mode}",
  "run.done": "✓ Done ({steps} steps).",
  "run.stopped":
    "⚠ Stopped after {steps} steps without a finish signal. You can continue with another instruction.",
  "run.confirm": "Allow {summary}?",
  "run.reprompt": "↻ no tool call — reinforcing instructions (attempt {attempt})",
  "run.autocorrect": "↻ tool failed — auto-correcting with extra context",
  "run.cancelled": "■ cancelled",
  "compaction.done": "context compacted: ~{before} → ~{after} tokens",
  "tools.customLoaded": "loaded custom tool(s): {names}",
  "run.jsonNeedsTask": "--json requires a task argument (headless mode has no interactive REPL).",
  "review.approveAll": "approve all",
  "review.reject": "reject",
  "review.pickHunks": "pick hunks…",
  "review.selectHunks": "Select the hunks to apply (space to toggle, enter to confirm)",
  "verify.running": "verifying (running project checks)",
  "verify.noChecks": "no verification checks detected (no package.json scripts) — skipping",
  "verify.passed": "verification passed",
  "verify.failed": "{n} check(s) failed — handing the output back to the agent (attempt {attempt})",
  "verify.giveUp": "{n} check(s) still failing after the retry budget — stopping",
  "budget.session": "session spend: {spent} / budget {budget}",
  "budget.hit": "■ stopped: estimated cost reached the budget of {budget}",

  // usage analytics
  "usage.header": "Usage (tokens / estimated cost) per day:",
  "usage.empty": "No usage recorded yet. Run a task to start tracking.",
  "usage.total": "total",
  "usage.runs": "runs",

  // sessions
  "sessions.header": "Saved sessions (most recent first):",
  "sessions.empty": "No saved sessions yet.",
  "sessions.hint": "Resume with `polypus run --continue` or `polypus run --resume <id>`.",
  "sessions.notFound": 'No saved session with id "{id}".',
  "sessions.noneToContinue": "No previous session to continue — starting fresh.",
  "sessions.resumed": "↺ resumed session {id} ({n} messages)",

  // repl
  "repl.welcome": "Polypus interactive session.",
  "repl.welcomeHint": " Type /help for commands, /exit to quit.",
  "repl.modeChanged": "mode → {mode}",
  "repl.allowAdded": "allow-list += {glob}",
  "repl.allowShow": "mode={mode} allow=[{allow}]",
  "repl.historyCleared": "history cleared",
  "repl.unknown": "Unknown command /{cmd}. Type /help.",
  "repl.pasted": "[Pasted text #{id} +{lines} lines]",
  "repl.agentSwitched": "active agent → {name}",
  "repl.switchedTo": "active agent is now {name}",
  "repl.noAgentsLeft": "No agents left. Use /add to create one.",
  "repl.needName": "Usage: {usage}",
  "repl.help": [
    "Slash commands:",
    "  /agents          list configured agents",
    "  /agent <name>    switch the active agent",
    "  /add             add a new agent (wizard)",
    "  /remove <name>   remove an agent",
    "  /plan            switch to plan mode (read-only)",
    "  /review          switch to review mode (confirm each action)",
    "  /bypass          switch to bypass mode (auto-approve)",
    "  /swarm <task>    run a task as a parallel swarm (needs 3+ agents)",
    "  /allow <glob>    add a path glob to the allow-list",
    "  /allow           show the current allow-list and mode",
    "  /reset           clear the conversation history",
    "  /sessions        list saved sessions you can resume",
    "  /resume <id>     resume a saved session",
    "  /help            show this help",
    "  /exit            quit",
    "Anything else is sent to the agent as a task.",
  ].join("\n"),

  // swarm
  "swarm.noAgents": "No agents configured. Run `polypus setup` or `polypus add-agent` first.",
  "swarm.needsAgents":
    "Swarm mode needs at least {min} configured agents (you have {have}). Add more with `polypus add-agent`, or use `polypus run` for a single agent.",
  "swarm.status": "swarm agents=[{agents}] workspace={workspace}",
  "swarm.bypassNote":
    "Workers run in bypass mode inside isolated git worktrees; branches are merged at the end.",
  "swarm.cancelling": "cancelling swarm — finishing in-flight workers, then merging what committed…",
  "swarm.decomposed": "Decomposed into {n} subtask(s):",
  "swarm.workerStart": "▶ {id} started by {agent}",
  "swarm.workerDone": "✓ {id} done",
  "swarm.workerStopped": "… {id} stopped",
  "swarm.workerMeta": " ({steps} steps, {changes})",
  "swarm.changesCommitted": "changes committed",
  "swarm.noChanges": "no changes",
  "swarm.merged": "  merged {branch}",
  "swarm.mergeConflict": "  conflict merging {branch}",
  "swarm.summary": "Summary:",
  "swarm.allMerged": "✓ All committed branches merged cleanly.",
  "swarm.view.header": "Swarm · orchestrator [{lead}]",
  "swarm.view.decomposing": "splitting the task…",
  "swarm.view.pending": "queued",
  "swarm.view.running": "running",
  "swarm.view.done": "done",
  "swarm.view.stopped": "stopped",
  "swarm.view.conflict": "conflict",
  "swarm.view.step": "step {n}",
  "swarm.view.steps": "{n} steps",
  "swarm.conflictsHeader": "⚠ {n} branch(es) had merge conflicts (kept for inspection):",
  "swarm.statusDone": "done",
  "swarm.statusIncomplete": "incomplete",

  // init
  "init.created": "✓ .poly scaffolded:",
  "init.skipped": "Kept (already existed):",
  "init.allExist": "Nothing to do — .poly already has these files:",
  "init.forceHint": "Run `polypus init --force` to overwrite them.",
  "init.tip": "Tip: edit .poly/agents.md — Polypus loads it into the agent's context automatically.",

  // wizard
  "wizard.title": " polypus setup ",
  "wizard.intro": [
    "Polypus drives any AI API to read and write code in this kind of project.",
    "You can add several agents (different keys/models) and they can work in parallel.",
    "Tip: reference API keys via environment variables instead of pasting them here.",
  ].join("\n"),
  "wizard.welcome": "Welcome",
  "wizard.cancelled": "Setup cancelled.",
  "wizard.language": "Interface language",
  "wizard.addAnother": "Add another agent?",
  "wizard.defaultAgent": "Default agent",
  "wizard.permMode": "Default permission mode",
  "wizard.permReview": "review — confirm each file write / command (safe default)",
  "wizard.permPlan": "plan — read-only, propose changes",
  "wizard.permBypass": "bypass — auto-approve everything (use with care)",
  "wizard.allowPaths": "Editable paths (comma-separated globs)",
  "wizard.saved": "Saved {n} agent(s) to {path}",
  "wizard.next": 'Run `polypus run "your task"` to start, or `polypus run` for an interactive session.',
  "wizard.provider": "Provider",
  "wizard.providerOpenrouter": "OpenRouter (hosted, many models)",
  "wizard.providerOllama": "Ollama (local models)",
  "wizard.providerCompatible": "OpenAI-compatible (custom base URL)",
  "wizard.providerAnthropic": "Anthropic (Claude)",
  "wizard.agentName": "Agent name",
  "wizard.required": "Required",
  "wizard.nameTaken": "An agent with this name already exists",
  "wizard.modelId": "Model id",
  "wizard.ollamaDetecting": "Detecting models on your local Ollama…",
  "wizard.ollamaFound": "Found {n} local Ollama model(s)",
  "wizard.ollamaNone": "Ollama not reachable — type the model id manually",
  "wizard.ollamaPick": "Model (detected on your Ollama)",
  "wizard.ollamaOther": "Other (type it manually)",
  "wizard.orError": "Could not reach OpenRouter — type the model id manually",
  "wizard.orSearch": "Search by id/name (optional)",
  "wizard.orFilters": "Filters (space to toggle, enter to confirm)",
  "wizard.orToolsOnly": "Only models with native tools",
  "wizard.orFreeOnly": "Only free models",
  "wizard.orSort": "Sort by",
  "wizard.orSortPrice": "price — cheapest first",
  "wizard.orSortPriceDesc": "price — most expensive first",
  "wizard.orSortContext": "context length",
  "wizard.orSortName": "name",
  "wizard.orPick": "Pick a model ({n} matches)",
  "wizard.orRefilter": "↻ change filters",
  "wizard.orManual": "✎ type the model id manually",
  "wizard.orNone": "No models match — adjust the filters",
  "wizard.baseUrl": "Base URL",
  "wizard.baseUrlRequired": "Required for openai-compatible",
  "wizard.toolMode": "Tool-calling mode",
  "wizard.toolAuto": "auto — native for hosted, emulated for local (recommended)",
  "wizard.toolNative": "native — provider function-calling",
  "wizard.toolEmulated": "emulated — XML tool protocol in the prompt (works without tool support)",
  "wizard.keyNotNeeded": "{provider} usually needs no API key. Add one anyway?",
  "wizard.apiKey": "API key",
  "wizard.keyEnv": "Reference an environment variable (recommended)",
  "wizard.keyInline": "Enter it now (stored in the config file)",
  "wizard.keySkip": "Skip for now",
  "wizard.envName": "Environment variable name",
  "wizard.envInvalid": "Use letters, digits, underscores",
  "wizard.keyPrompt": "API key (stored in plain text in the config file)",

  // models browser
  "models.fetching": "Fetching OpenRouter models…",
  "models.fetchError": "Could not fetch models: {msg}",
  "models.none": "No models match the filters.",
  "models.shown": "Showing {shown} of {total} models",
  "models.legend": "🛠 = native tools · prices = USD per 1M tokens (in/out)",
  "models.colTools": "TOOLS",
  "models.colPrice": "PRICE in/out",
  "models.colCtx": "CONTEXT",
  "models.colModel": "MODEL",

  // live status
  "ui.thinking": "thinking",
  "ui.running": "running {tool}",
  "ui.tokens": "{total} tokens (in {in} / out {out})",
  "ui.tokensShort": "{total} tok",

  // welcome / interactive UI
  "welcome.tagline": "agentic harness — make any AI write code",
  "welcome.agent": "agent",
  "welcome.model": "model",
  "welcome.mode": "mode",
  "welcome.workspace": "folder",
  "welcome.hints": "Type your task and press Enter  ·  ESC cancels  ·  /help  ·  /exit",
  "welcome.firstRun": "No agents configured yet — let's set you up.",

  // agent system prompt
  "prompt.language": "Communicate with the user in {language}.",
  "prompt.projectInstructions":
    "Project-specific operating instructions follow, loaded from `.poly/agents.md`. Treat them as authoritative for how to work in THIS repo. Paths they reference (e.g. skills/*.md, ../context.md, ../rules.md) are relative to the `.poly/` directory — read those files when relevant before acting:",

  // @-mentions
  "mentions.injectedHeader": "Referenced files (@-mentions)",
  "mentions.dirHeader": "@{path} (directory listing)",
  "mentions.notFound": "(could not resolve @{path}: not found or outside the allow-list)",

  // safety policy
  "policy.blockedCommand": "blocked by safety policy ({reason}) — refusing in all modes",
  "policy.secretFound":
    "write blocked: a possible secret ({kind}) was found on line {line}. Remove it or load it from an environment variable instead of hard-coding it.",
};

const ptBR: Catalog = {
  "common.default": "padrão",
  "common.keySet": "com chave",
  "common.noKey": "sem chave",

  "cli.description":
    "Harness agêntico que faz qualquer API de IA gerar e aplicar código — OpenRouter, Ollama e qualquer endpoint compatível com OpenAI.",
  "cli.opt.lang": "idioma da interface: pt-BR | en",
  "cli.cmd.setup": "Assistente de configuração interativo (agentes, chaves, permissões)",
  "cli.cmd.init": "Cria um workspace .poly/ (agents.md, skills, template de spec SDD, README)",
  "cli.opt.force": "sobrescreve arquivos que já existem",
  "cli.cmd.addAgent": "Cadastra um novo agente (chave de API + modelo)",
  "cli.cmd.removeAgent": "Remove um agente configurado",
  "cli.cmd.listAgents": "Lista os agentes configurados",
  "cli.cmd.run": "Executa uma tarefa de código com um agente",
  "cli.cmd.swarm":
    "Divide uma tarefa entre vários agentes em git worktrees paralelas (requer 3+ agentes configurados)",
  "cli.cmd.models": "Explora os modelos do OpenRouter (preço, contexto, suporte a tools)",
  "cli.cmd.prd": "Gera um PRD a partir de uma issue do GitHub (usa um modelo gratuito do OpenRouter)",
  "cli.arg.prdIssue": "número da issue para transformar em PRD",
  "cli.cmd.review": "Revisa o diff de um pull request (usa um modelo gratuito do OpenRouter)",
  "cli.arg.reviewPr": "número do pull request a revisar",
  "cli.opt.out": "grava a saída neste arquivo em vez do stdout",
  "cli.opt.input": 'lê a entrada de um arquivo (ou "-" para stdin) em vez de chamar o gh',
  "prd.wrote": "✓ PRD gravado em {path}",
  "review.wrote": "✓ Review gravado em {path}",
  "cli.invalidRef": "Número inválido '{ref}': esperado um número de issue/PR.",
  "cli.stdinTty": "--input - espera entrada via pipe (stdin), mas nenhuma foi fornecida.",
  "cli.opt.search": "filtra por trecho do id/nome",
  "cli.opt.toolsOnly": "apenas modelos com suporte a tool-calling",
  "cli.opt.free": "apenas modelos gratuitos",
  "cli.opt.maxPrice": "preço máximo de entrada (USD por 1M tokens)",
  "cli.opt.sort": "price | price-desc | context | name",
  "cli.opt.limit": "máximo de linhas a exibir",
  "cli.arg.addAgentName": "nome único para o agente",
  "cli.opt.provider": "openrouter | ollama | openai-compatible | anthropic",
  "cli.opt.model": "id do modelo, ex.: anthropic/claude-3.5-sonnet ou llama3.1",
  "cli.opt.apiKey": 'chave de API ou referência de env como "${OPENROUTER_API_KEY}"',
  "cli.opt.baseUrl": "sobrescreve a URL base do provider",
  "cli.opt.toolMode": "auto | native | emulated",
  "cli.opt.setDefault": "define como agente padrão",
  "cli.arg.removeAgentName": "nome do agente a remover",
  "cli.arg.runTask": "tarefa para o agente; omita para iniciar uma sessão interativa",
  "cli.opt.agent": "qual agente configurado usar",
  "cli.opt.mode": "plan | review | bypass (sobrescreve a config)",
  "cli.opt.maxSteps": "número máximo de passos do agente",
  "cli.opt.json": "modo headless: emite um único objeto JSON (passos, tool calls, arquivos alterados, uso) em vez da TUI — use com --mode bypass",
  "cli.opt.verify": "após o agente terminar, roda as checagens do projeto (typecheck/build/test) e itera até passar",
  "cli.opt.budget": "interrompe a execução quando o custo estimado da sessão atingir este valor em USD (preços do OpenRouter)",
  "cli.cmd.usage": "Mostra analytics de tokens/custo agregados por dia",
  "cli.cmd.sessions": "Lista as sessões salvas que podem ser retomadas",
  "cli.opt.continue": "retoma a sessão salva mais recente",
  "cli.opt.resume": "retoma uma sessão salva específica pelo id",
  "cli.arg.swarmTask": "tarefa de alto nível para dividir entre os agentes",
  "cli.opt.agents": "nomes de agentes separados por vírgula (padrão: todos)",
  "cli.opt.maxSubtasks": "número máximo de subtarefas paralelas",

  "agent.exists": 'Já existe um agente chamado "{name}". Use remove-agent antes para substituí-lo.',
  "agent.needBaseUrl": 'O provider "{provider}" exige --base-url.',
  "agent.needApiKey":
    'O provider "{provider}" exige uma chave de API. Passe --api-key "${ENV_VAR}" (recomendado) ou um valor literal.',
  "agent.added": "✓ Agente {name} adicionado",
  "agent.removed": "✓ Agente {name} removido",
  "agent.notFound": 'Não existe agente chamado "{name}".',
  "agent.none": "Nenhum agente configurado. Rode `polypus setup` ou `polypus add-agent`.",
  "agent.listHeader": "Agentes:",
  "agent.permLine": "Permissões: modo={mode}, allow=[{allow}]",
  "agent.noneKnown": 'Não existe agente chamado "{name}". Agentes conhecidos: {names}',
  "agent.needAnthropicKey": 'O agente "{name}" (anthropic) exige uma chave de API.',
  "agent.noBaseUrl": 'O agente "{name}" não tem URL base configurada.',
  "agent.noneConfigured": "Nenhum agente configurado. Rode `polypus setup` ou `polypus add-agent` primeiro.",
  "agent.multipleNoDefault":
    "Vários agentes configurados mas sem padrão definido. Passe --agent <nome> ou defina um padrão. Agentes: {names}",

  "run.status":
    "agente={name} provider={provider} modelo={model} tool-mode={toolMode} modo-permissão={mode}",
  "run.done": "✓ Concluído ({steps} passos).",
  "run.stopped":
    "⚠ Parou após {steps} passos sem sinal de conclusão. Você pode continuar com outra instrução.",
  "run.confirm": "Permitir {summary}?",
  "run.reprompt": "↻ nenhuma chamada de tool — reforçando instruções (tentativa {attempt})",
  "run.autocorrect": "↻ tool falhou — autocorrigindo com contexto extra",
  "run.cancelled": "■ cancelado",
  "compaction.done": "contexto compactado: ~{before} → ~{after} tokens",
  "tools.customLoaded": "tool(s) customizada(s) carregada(s): {names}",
  "run.jsonNeedsTask": "--json exige um argumento de tarefa (o modo headless não tem REPL interativo).",
  "review.approveAll": "aprovar tudo",
  "review.reject": "rejeitar",
  "review.pickHunks": "escolher hunks…",
  "review.selectHunks": "Selecione os hunks a aplicar (espaço alterna, enter confirma)",
  "verify.running": "verificando (rodando as checagens do projeto)",
  "verify.noChecks": "nenhuma checagem detectada (sem scripts no package.json) — pulando",
  "verify.passed": "verificação passou",
  "verify.failed": "{n} checagem(ns) falharam — devolvendo a saída ao agente (tentativa {attempt})",
  "verify.giveUp": "{n} checagem(ns) ainda falhando após o limite de tentativas — parando",
  "budget.session": "gasto da sessão: {spent} / orçamento {budget}",
  "budget.hit": "■ interrompido: o custo estimado atingiu o orçamento de {budget}",

  // usage analytics
  "usage.header": "Uso (tokens / custo estimado) por dia:",
  "usage.empty": "Nenhum uso registrado ainda. Rode uma tarefa para começar a medir.",
  "usage.total": "total",
  "usage.runs": "execuções",

  // sessions
  "sessions.header": "Sessões salvas (mais recentes primeiro):",
  "sessions.empty": "Nenhuma sessão salva ainda.",
  "sessions.hint": "Retome com `polypus run --continue` ou `polypus run --resume <id>`.",
  "sessions.notFound": 'Nenhuma sessão salva com id "{id}".',
  "sessions.noneToContinue": "Nenhuma sessão anterior para continuar — começando do zero.",
  "sessions.resumed": "↺ sessão {id} retomada ({n} mensagens)",

  "repl.welcome": "Sessão interativa do Polypus.",
  "repl.welcomeHint": " Digite /help para comandos, /exit para sair.",
  "repl.modeChanged": "modo → {mode}",
  "repl.allowAdded": "allow-list += {glob}",
  "repl.allowShow": "modo={mode} allow=[{allow}]",
  "repl.historyCleared": "histórico limpo",
  "repl.unknown": "Comando desconhecido /{cmd}. Digite /help.",
  "repl.pasted": "[Texto colado #{id} +{lines} linhas]",
  "repl.agentSwitched": "agente ativo → {name}",
  "repl.switchedTo": "agente ativo agora é {name}",
  "repl.noAgentsLeft": "Nenhum agente restante. Use /add para criar um.",
  "repl.needName": "Uso: {usage}",
  "repl.help": [
    "Comandos de barra:",
    "  /agents          lista os agentes configurados",
    "  /agent <nome>    troca o agente ativo",
    "  /add             adiciona um novo agente (wizard)",
    "  /remove <nome>   remove um agente",
    "  /plan            muda para o modo plan (somente leitura)",
    "  /review          muda para o modo review (confirma cada ação)",
    "  /bypass          muda para o modo bypass (aprova automaticamente)",
    "  /swarm <task>    roda a tarefa como swarm paralelo (requer 3+ agentes)",
    "  /allow <glob>    adiciona um glob de caminho à allow-list",
    "  /allow           mostra a allow-list e o modo atuais",
    "  /reset           limpa o histórico da conversa",
    "  /sessions        lista as sessões salvas que você pode retomar",
    "  /resume <id>     retoma uma sessão salva",
    "  /help            mostra esta ajuda",
    "  /exit            sair",
    "Qualquer outra coisa é enviada ao agente como tarefa.",
  ].join("\n"),

  "swarm.noAgents": "Nenhum agente configurado. Rode `polypus setup` ou `polypus add-agent` primeiro.",
  "swarm.needsAgents":
    "O modo swarm precisa de pelo menos {min} agentes configurados (você tem {have}). Adicione mais com `polypus add-agent`, ou use `polypus run` para um agente só.",
  "swarm.status": "swarm agentes=[{agents}] workspace={workspace}",
  "swarm.bypassNote":
    "Os workers rodam em modo bypass dentro de git worktrees isoladas; os branches são mesclados no final.",
  "swarm.cancelling": "cancelando o swarm — encerrando os workers em andamento e mesclando o que commitou…",
  "swarm.decomposed": "Dividido em {n} subtarefa(s):",
  "swarm.workerStart": "▶ {id} iniciada por {agent}",
  "swarm.workerDone": "✓ {id} concluída",
  "swarm.workerStopped": "… {id} parou",
  "swarm.workerMeta": " ({steps} passos, {changes})",
  "swarm.changesCommitted": "alterações commitadas",
  "swarm.noChanges": "sem alterações",
  "swarm.merged": "  mesclado {branch}",
  "swarm.mergeConflict": "  conflito ao mesclar {branch}",
  "swarm.summary": "Resumo:",
  "swarm.allMerged": "✓ Todos os branches commitados foram mesclados sem conflito.",
  "swarm.view.header": "Swarm · orquestrador [{lead}]",
  "swarm.view.decomposing": "dividindo a tarefa…",
  "swarm.view.pending": "na fila",
  "swarm.view.running": "executando",
  "swarm.view.done": "concluído",
  "swarm.view.stopped": "parado",
  "swarm.view.conflict": "conflito",
  "swarm.view.step": "passo {n}",
  "swarm.view.steps": "{n} passos",
  "swarm.conflictsHeader": "⚠ {n} branch(es) tiveram conflitos de merge (mantidos para inspeção):",
  "swarm.statusDone": "ok",
  "swarm.statusIncomplete": "incompleta",

  // init
  "init.created": "✓ .poly criado:",
  "init.skipped": "Mantidos (já existiam):",
  "init.allExist": "Nada a fazer — o .poly já tem estes arquivos:",
  "init.forceHint": "Rode `polypus init --force` para sobrescrevê-los.",
  "init.tip": "Dica: edite o .poly/agents.md — o Polypus carrega ele no contexto do agente automaticamente.",

  "wizard.title": " configuração do polypus ",
  "wizard.intro": [
    "O Polypus comanda qualquer API de IA para ler e escrever código neste tipo de projeto.",
    "Você pode adicionar vários agentes (chaves/modelos diferentes) e eles trabalham em paralelo.",
    "Dica: referencie chaves de API por variáveis de ambiente em vez de colá-las aqui.",
  ].join("\n"),
  "wizard.welcome": "Bem-vindo",
  "wizard.cancelled": "Configuração cancelada.",
  "wizard.language": "Idioma da interface",
  "wizard.addAnother": "Adicionar outro agente?",
  "wizard.defaultAgent": "Agente padrão",
  "wizard.permMode": "Modo de permissão padrão",
  "wizard.permReview": "review — confirma cada escrita/comando (padrão seguro)",
  "wizard.permPlan": "plan — somente leitura, propõe mudanças",
  "wizard.permBypass": "bypass — aprova tudo automaticamente (use com cuidado)",
  "wizard.allowPaths": "Caminhos editáveis (globs separados por vírgula)",
  "wizard.saved": "{n} agente(s) salvos em {path}",
  "wizard.next": 'Rode `polypus run "sua tarefa"` para começar, ou `polypus run` para uma sessão interativa.',
  "wizard.provider": "Provider",
  "wizard.providerOpenrouter": "OpenRouter (hospedado, muitos modelos)",
  "wizard.providerOllama": "Ollama (modelos locais)",
  "wizard.providerCompatible": "Compatível com OpenAI (URL base customizada)",
  "wizard.providerAnthropic": "Anthropic (Claude)",
  "wizard.agentName": "Nome do agente",
  "wizard.required": "Obrigatório",
  "wizard.nameTaken": "Já existe um agente com esse nome",
  "wizard.modelId": "Id do modelo",
  "wizard.ollamaDetecting": "Detectando modelos no seu Ollama local…",
  "wizard.ollamaFound": "{n} modelo(s) do Ollama encontrado(s)",
  "wizard.ollamaNone": "Ollama não acessível — digite o id do modelo manualmente",
  "wizard.ollamaPick": "Modelo (detectado no seu Ollama)",
  "wizard.ollamaOther": "Outro (digitar manualmente)",
  "wizard.orError": "Não foi possível acessar o OpenRouter — digite o id do modelo manualmente",
  "wizard.orSearch": "Buscar por id/nome (opcional)",
  "wizard.orFilters": "Filtros (espaço alterna, enter confirma)",
  "wizard.orToolsOnly": "Apenas modelos com tools nativas",
  "wizard.orFreeOnly": "Apenas modelos gratuitos",
  "wizard.orSort": "Ordenar por",
  "wizard.orSortPrice": "preço — mais baratos primeiro",
  "wizard.orSortPriceDesc": "preço — mais caros primeiro",
  "wizard.orSortContext": "tamanho do contexto",
  "wizard.orSortName": "nome",
  "wizard.orPick": "Escolha um modelo ({n} resultados)",
  "wizard.orRefilter": "↻ mudar filtros",
  "wizard.orManual": "✎ digitar o id do modelo manualmente",
  "wizard.orNone": "Nenhum modelo corresponde — ajuste os filtros",
  "wizard.baseUrl": "URL base",
  "wizard.baseUrlRequired": "Obrigatório para openai-compatible",
  "wizard.toolMode": "Modo de tool-calling",
  "wizard.toolAuto": "auto — nativo para hospedados, emulado para locais (recomendado)",
  "wizard.toolNative": "native — function-calling do provider",
  "wizard.toolEmulated": "emulated — protocolo XML de tools no prompt (funciona sem suporte a tools)",
  "wizard.keyNotNeeded": "{provider} normalmente não precisa de chave. Adicionar mesmo assim?",
  "wizard.apiKey": "Chave de API",
  "wizard.keyEnv": "Referenciar uma variável de ambiente (recomendado)",
  "wizard.keyInline": "Digitar agora (armazenada no arquivo de config)",
  "wizard.keySkip": "Pular por enquanto",
  "wizard.envName": "Nome da variável de ambiente",
  "wizard.envInvalid": "Use letras, dígitos e sublinhados",
  "wizard.keyPrompt": "Chave de API (armazenada em texto puro no arquivo de config)",

  "prompt.language": "Comunique-se com o usuário em {language}.",
  "prompt.projectInstructions":
    "Seguem instruções operacionais específicas do projeto, carregadas de `.poly/agents.md`. Trate-as como autoritativas para trabalhar NESTE repositório. Os caminhos que elas citam (ex.: skills/*.md, ../context.md, ../rules.md) são relativos à pasta `.poly/` — leia esses arquivos quando relevante antes de agir:",

  // @-mentions
  "mentions.injectedHeader": "Arquivos referenciados (@-mentions)",
  "mentions.dirHeader": "@{path} (conteúdo do diretório)",
  "mentions.notFound": "(não foi possível resolver @{path}: não encontrado ou fora da allow-list)",

  // safety policy
  "policy.blockedCommand": "bloqueado pela política de segurança ({reason}) — recusado em todos os modos",
  "policy.secretFound":
    "escrita bloqueada: possível segredo ({kind}) encontrado na linha {line}. Remova-o ou carregue de uma variável de ambiente em vez de fixá-lo no código.",

  "models.fetching": "Buscando modelos do OpenRouter…",
  "models.fetchError": "Não foi possível buscar modelos: {msg}",
  "models.none": "Nenhum modelo corresponde aos filtros.",
  "models.shown": "Mostrando {shown} de {total} modelos",
  "models.legend": "🛠 = tools nativas · preços = USD por 1M tokens (entrada/saída)",
  "models.colTools": "TOOLS",
  "models.colPrice": "PREÇO ent/saí",
  "models.colCtx": "CONTEXTO",
  "models.colModel": "MODELO",

  "ui.thinking": "pensando",
  "ui.running": "executando {tool}",
  "ui.tokens": "{total} tokens (entrada {in} / saída {out})",
  "ui.tokensShort": "{total} tok",

  "welcome.tagline": "harness agêntico — faça qualquer IA escrever código",
  "welcome.agent": "agente",
  "welcome.model": "modelo",
  "welcome.mode": "modo",
  "welcome.workspace": "pasta",
  "welcome.hints": "Digite sua tarefa e tecle Enter  ·  ESC cancela  ·  /help  ·  /exit",
  "welcome.firstRun": "Nenhum agente configurado ainda — vamos te configurar.",
};

const CATALOGS: Record<Locale, Catalog> = { en, "pt-BR": ptBR };

let currentLocale: Locale = DEFAULT_LOCALE;

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Resolve the active locale by precedence: explicit flag > POLYPUS_LANG env >
 * config value > default (pt-BR). Invalid values are ignored.
 */
export function pickLocale(opts: { flag?: string; config?: string }): Locale {
  const candidates = [opts.flag, process.env.POLYPUS_LANG, opts.config];
  for (const c of candidates) {
    if (isLocale(c)) return c;
  }
  return DEFAULT_LOCALE;
}

/** Translate a key, interpolating {placeholders}. Falls back to English, then the key. */
export function t(key: string, params?: Record<string, string | number>): string {
  const template = CATALOGS[currentLocale][key] ?? en[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in params ? String(params[name]) : `{${name}}`,
  );
}
