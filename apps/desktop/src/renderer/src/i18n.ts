/**
 * Minimal renderer-side i18n for the Cowork UI (#119). Kept separate from the
 * Node-side `src/core/i18n` (different package/runtime); the two can be unified
 * once core is consumed as a library. pt-BR is the default.
 */
export type Lang = "pt-BR" | "en";

export type StringKey =
  | "nav.projects"
  | "nav.sessions"
  | "nav.new"
  | "nav.config"
  | "nav.emptyProjects"
  | "nav.emptySessions"
  | "nav.mcpServers"
  | "header.chat"
  | "ctx.project"
  | "ctx.agent"
  | "ctx.mode"
  | "ctx.cost"
  | "ctx.bridge"
  | "ctx.bridgeReady"
  | "chat.empty"
  | "chat.placeholder"
  | "chat.running"
  | "chat.bridgeUnavailable"
  | "chat.noProject"
  | "mode.plan.hint"
  | "mode.review.hint"
  | "mode.bypass.hint"
  | "settings.theme"
  | "settings.lang"
  | "settings.agents"
  | "settings.mcp"
  | "tab.chat"
  | "tab.rag"
  | "rag.title"
  | "rag.reindex"
  | "rag.indexing"
  | "rag.searchPlaceholder"
  | "rag.search"
  | "rag.searching"
  | "rag.hint"
  | "cowork.prompt"
  | "cowork.placeholder"
  | "cowork.run"
  | "cowork.running"
  | "cowork.done"
  | "cowork.noFolder"
  | "cowork.chooseFolder"
  | "cowork.newTask"
  | "cowork.files"
  | "cowork.steps"
  | "mcp.title"
  | "mcp.add"
  | "mcp.name"
  | "mcp.command"
  | "mcp.args"
  | "mcp.argsHint"
  | "mcp.env"
  | "mcp.envHint"
  | "mcp.test"
  | "mcp.testing"
  | "mcp.remove"
  | "mcp.confirm"
  | "mcp.noProject"
  | "mcp.empty"
  | "mcp.save"
  | "mcp.cancel"
  | "mcp.tools"
  | "mcp.noTools"
  | "mcp.addEnv"
  | "nav.newSession"
  | "nav.deleteSession"
  | "nav.confirmDelete"
  | "nav.files"
  | "nav.noFiles"
  | "file.loading"
  | "file.error"
  | "file.close"
  | "usage.tokens"
  | "usage.cost";

const STRINGS: Record<Lang, Record<StringKey, string>> = {
  "pt-BR": {
    "nav.projects": "Projetos",
    "nav.sessions": "Sessões",
    "nav.new": "＋ Nova",
    "nav.config": "⚙ Config",
    "nav.emptyProjects": "Nenhum projeto recente.",
    "nav.emptySessions": "Nenhuma sessão salva.",
    "nav.mcpServers": "⚡ {{n}} servidor(es) MCP",
    "header.chat": "chat / execução",
    "ctx.project": "Projeto",
    "ctx.agent": "Agente",
    "ctx.mode": "Modo",
    "ctx.cost": "Custo",
    "ctx.bridge": "Ponte",
    "ctx.bridgeReady": "pronta",
    "chat.empty": "Digite uma tarefa para o agente começar.",
    "chat.placeholder": "digite uma tarefa…  (Enter envia · Shift+Enter nova linha · @ para anexar arquivo)",
    "chat.running": "executando…",
    "chat.noProject": "Selecione uma pasta de projeto antes de iniciar.",
    "chat.bridgeUnavailable": "Ponte indisponível (window.polypus). Rode pelo Electron.",
    "mode.plan.hint": "só planeja, não altera nada",
    "mode.review.hint": "pausa e pede aprovação a cada mudança",
    "mode.bypass.hint": "aplica tudo sem perguntar",
    "settings.theme": "Tema",
    "settings.lang": "Idioma",
    "settings.agents": "Agentes",
    "settings.mcp": "MCP",
    "tab.chat": "Chat",
    "tab.rag": "Índice (RAG)",
    "rag.title": "Índice semântico do projeto",
    "rag.reindex": "Reindexar",
    "rag.indexing": "indexando…",
    "rag.searchPlaceholder": "buscar por significado… (ex.: onde validamos permissões)",
    "rag.search": "Buscar",
    "rag.searching": "buscando…",
    "rag.hint": "Reindexe e busque trechos relevantes do repositório por significado.",
    "cowork.prompt": "O que vamos construir hoje?",
    "cowork.placeholder": "Descreva a tarefa…\n\nEx: Adicionar autenticação JWT ao endpoint /login\nEx: Corrigir o cálculo de estoque no módulo de pedidos",
    "cowork.run": "Executar",
    "cowork.running": "executando…",
    "cowork.done": "✓ concluído",
    "cowork.noFolder": "Escolha uma pasta de projeto para começar.",
    "cowork.chooseFolder": "Escolher pasta",
    "cowork.newTask": "Nova tarefa",
    "cowork.files": "arquivo(s) alterado(s)",
    "cowork.steps": "step(s)",
    "mcp.title": "Servidores MCP",
    "mcp.add": "+ Adicionar servidor",
    "mcp.name": "Nome",
    "mcp.command": "Comando",
    "mcp.args": "Args",
    "mcp.argsHint": "separados por espaço",
    "mcp.env": "Variáveis de ambiente",
    "mcp.envHint": "CHAVE=valor",
    "mcp.test": "Testar",
    "mcp.testing": "testando…",
    "mcp.remove": "Remover",
    "mcp.confirm": "Tem certeza?",
    "mcp.noProject": "Selecione um projeto para configurar servidores MCP.",
    "mcp.empty": "Nenhum servidor configurado.",
    "mcp.save": "Salvar",
    "mcp.cancel": "Cancelar",
    "mcp.tools": "tool(s)",
    "mcp.noTools": "Nenhuma tool encontrada.",
    "mcp.addEnv": "+ Env",
    "nav.newSession": "＋ Nova sessão",
    "nav.deleteSession": "Excluir",
    "nav.confirmDelete": "Excluir?",
    "nav.files": "Arquivos",
    "nav.noFiles": "Pasta vazia.",
    "file.loading": "carregando…",
    "file.error": "Não foi possível ler o arquivo.",
    "file.close": "Fechar",
    "usage.tokens": "tokens",
    "usage.cost": "custo est.",
  },
  en: {
    "nav.projects": "Projects",
    "nav.sessions": "Sessions",
    "nav.new": "＋ New",
    "nav.config": "⚙ Settings",
    "nav.emptyProjects": "No recent projects.",
    "nav.emptySessions": "No saved sessions.",
    "nav.mcpServers": "⚡ {{n}} MCP server(s)",
    "header.chat": "chat / run",
    "ctx.project": "Project",
    "ctx.agent": "Agent",
    "ctx.mode": "Mode",
    "ctx.cost": "Cost",
    "ctx.bridge": "Bridge",
    "ctx.bridgeReady": "ready",
    "chat.empty": "Type a task to get the agent started.",
    "chat.placeholder": "type a task…  (Enter sends · Shift+Enter newline · @ to attach a file)",
    "chat.running": "running…",
    "chat.noProject": "Select a project folder before starting.",
    "chat.bridgeUnavailable": "Bridge unavailable (window.polypus). Run via Electron.",
    "mode.plan.hint": "plans only, changes nothing",
    "mode.review.hint": "pauses for approval on every change",
    "mode.bypass.hint": "applies everything without asking",
    "settings.theme": "Theme",
    "settings.lang": "Language",
    "settings.agents": "Agents",
    "settings.mcp": "MCP",
    "tab.chat": "Chat",
    "tab.rag": "Index (RAG)",
    "rag.title": "Project semantic index",
    "rag.reindex": "Reindex",
    "rag.indexing": "indexing…",
    "rag.searchPlaceholder": "search by meaning… (e.g. where do we validate permissions)",
    "rag.search": "Search",
    "rag.searching": "searching…",
    "rag.hint": "Reindex and search the repo for relevant chunks by meaning.",
    "cowork.prompt": "What are we building today?",
    "cowork.placeholder": "Describe the task…\n\nE.g: Add JWT authentication to the /login endpoint\nE.g: Fix the inventory calculation in the orders module",
    "cowork.run": "Run",
    "cowork.running": "running…",
    "cowork.done": "✓ done",
    "cowork.noFolder": "Choose a project folder to get started.",
    "cowork.chooseFolder": "Choose folder",
    "cowork.newTask": "New task",
    "cowork.files": "file(s) changed",
    "cowork.steps": "step(s)",
    "mcp.title": "MCP Servers",
    "mcp.add": "+ Add server",
    "mcp.name": "Name",
    "mcp.command": "Command",
    "mcp.args": "Args",
    "mcp.argsHint": "space-separated",
    "mcp.env": "Environment variables",
    "mcp.envHint": "KEY=value",
    "mcp.test": "Test",
    "mcp.testing": "testing…",
    "mcp.remove": "Remove",
    "mcp.confirm": "Are you sure?",
    "mcp.noProject": "Select a project to configure MCP servers.",
    "mcp.empty": "No servers configured.",
    "mcp.save": "Save",
    "mcp.cancel": "Cancel",
    "mcp.tools": "tool(s)",
    "mcp.noTools": "No tools found.",
    "mcp.addEnv": "+ Env",
    "nav.newSession": "＋ New session",
    "nav.deleteSession": "Delete",
    "nav.confirmDelete": "Delete?",
    "nav.files": "Files",
    "nav.noFiles": "Empty folder.",
    "file.loading": "loading…",
    "file.error": "Could not read file.",
    "file.close": "Close",
    "usage.tokens": "tokens",
    "usage.cost": "est. cost",
  },
};

export function translate(lang: Lang, key: StringKey): string {
  return STRINGS[lang][key] ?? STRINGS["pt-BR"][key] ?? key;
}
