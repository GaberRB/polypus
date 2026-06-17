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
  "cli.cmd.addAgent": "Register a new agent (API key + model)",
  "cli.cmd.removeAgent": "Remove a configured agent",
  "cli.cmd.listAgents": "List configured agents",
  "cli.cmd.run": "Run a coding task with an agent",
  "cli.cmd.swarm": "Split a task across multiple agents working in parallel git worktrees",
  "cli.cmd.models": "Browse OpenRouter models (price, context, tool support)",
  "cli.cmd.prd": "Generate a PRD from a GitHub issue (uses a free OpenRouter model)",
  "cli.arg.prdIssue": "issue number to turn into a PRD",
  "cli.opt.out": "write output to this file instead of stdout",
  "cli.opt.input": 'read input from a file (or "-" for stdin) instead of calling gh',
  "prd.wrote": "✓ PRD written to {path}",
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

  // repl
  "repl.welcome": "Polypus interactive session.",
  "repl.welcomeHint": " Type /help for commands, /exit to quit.",
  "repl.modeChanged": "mode → {mode}",
  "repl.allowAdded": "allow-list += {glob}",
  "repl.allowShow": "mode={mode} allow=[{allow}]",
  "repl.historyCleared": "history cleared",
  "repl.unknown": "Unknown command /{cmd}. Type /help.",
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
    "  /allow <glob>    add a path glob to the allow-list",
    "  /allow           show the current allow-list and mode",
    "  /reset           clear the conversation history",
    "  /help            show this help",
    "  /exit            quit",
    "Anything else is sent to the agent as a task.",
  ].join("\n"),

  // swarm
  "swarm.noAgents": "No agents configured. Run `polypus setup` or `polypus add-agent` first.",
  "swarm.status": "swarm agents=[{agents}] workspace={workspace}",
  "swarm.bypassNote":
    "Workers run in bypass mode inside isolated git worktrees; branches are merged at the end.",
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
  "swarm.conflictsHeader": "⚠ {n} branch(es) had merge conflicts (kept for inspection):",
  "swarm.statusDone": "done",
  "swarm.statusIncomplete": "incomplete",

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
};

const ptBR: Catalog = {
  "common.default": "padrão",
  "common.keySet": "com chave",
  "common.noKey": "sem chave",

  "cli.description":
    "Harness agêntico que faz qualquer API de IA gerar e aplicar código — OpenRouter, Ollama e qualquer endpoint compatível com OpenAI.",
  "cli.opt.lang": "idioma da interface: pt-BR | en",
  "cli.cmd.setup": "Assistente de configuração interativo (agentes, chaves, permissões)",
  "cli.cmd.addAgent": "Cadastra um novo agente (chave de API + modelo)",
  "cli.cmd.removeAgent": "Remove um agente configurado",
  "cli.cmd.listAgents": "Lista os agentes configurados",
  "cli.cmd.run": "Executa uma tarefa de código com um agente",
  "cli.cmd.swarm": "Divide uma tarefa entre vários agentes trabalhando em paralelo em git worktrees",
  "cli.cmd.models": "Explora os modelos do OpenRouter (preço, contexto, suporte a tools)",
  "cli.cmd.prd": "Gera um PRD a partir de uma issue do GitHub (usa um modelo gratuito do OpenRouter)",
  "cli.arg.prdIssue": "número da issue para transformar em PRD",
  "cli.opt.out": "grava a saída neste arquivo em vez do stdout",
  "cli.opt.input": 'lê a entrada de um arquivo (ou "-" para stdin) em vez de chamar o gh',
  "prd.wrote": "✓ PRD gravado em {path}",
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

  "repl.welcome": "Sessão interativa do Polypus.",
  "repl.welcomeHint": " Digite /help para comandos, /exit para sair.",
  "repl.modeChanged": "modo → {mode}",
  "repl.allowAdded": "allow-list += {glob}",
  "repl.allowShow": "modo={mode} allow=[{allow}]",
  "repl.historyCleared": "histórico limpo",
  "repl.unknown": "Comando desconhecido /{cmd}. Digite /help.",
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
    "  /allow <glob>    adiciona um glob de caminho à allow-list",
    "  /allow           mostra a allow-list e o modo atuais",
    "  /reset           limpa o histórico da conversa",
    "  /help            mostra esta ajuda",
    "  /exit            sair",
    "Qualquer outra coisa é enviada ao agente como tarefa.",
  ].join("\n"),

  "swarm.noAgents": "Nenhum agente configurado. Rode `polypus setup` ou `polypus add-agent` primeiro.",
  "swarm.status": "swarm agentes=[{agents}] workspace={workspace}",
  "swarm.bypassNote":
    "Os workers rodam em modo bypass dentro de git worktrees isoladas; os branches são mesclados no final.",
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
  "swarm.conflictsHeader": "⚠ {n} branch(es) tiveram conflitos de merge (mantidos para inspeção):",
  "swarm.statusDone": "ok",
  "swarm.statusIncomplete": "incompleta",

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
