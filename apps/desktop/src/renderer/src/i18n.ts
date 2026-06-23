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
  | "mode.plan.hint"
  | "mode.review.hint"
  | "mode.bypass.hint"
  | "settings.theme"
  | "settings.lang"
  | "tab.chat"
  | "tab.rag"
  | "rag.title"
  | "rag.reindex"
  | "rag.indexing"
  | "rag.searchPlaceholder"
  | "rag.search"
  | "rag.searching"
  | "rag.hint";

const STRINGS: Record<Lang, Record<StringKey, string>> = {
  "pt-BR": {
    "nav.projects": "Projetos",
    "nav.sessions": "Sessões",
    "nav.new": "＋ Nova",
    "nav.config": "⚙ Config",
    "header.chat": "chat / execução",
    "ctx.project": "Projeto",
    "ctx.agent": "Agente",
    "ctx.mode": "Modo",
    "ctx.cost": "Custo",
    "ctx.bridge": "Ponte",
    "ctx.bridgeReady": "pronta",
    "chat.empty": "Digite uma tarefa para o agente começar.",
    "chat.placeholder": "digite uma tarefa…  (Enter envia · Shift+Enter nova linha · @arquivo p/ contexto)",
    "chat.running": "executando…",
    "chat.bridgeUnavailable": "Ponte indisponível (window.polypus). Rode pelo Electron.",
    "mode.plan.hint": "só planeja, não altera nada",
    "mode.review.hint": "pausa e pede aprovação a cada mudança",
    "mode.bypass.hint": "aplica tudo sem perguntar",
    "settings.theme": "Tema",
    "settings.lang": "Idioma",
    "tab.chat": "Chat",
    "tab.rag": "Índice (RAG)",
    "rag.title": "Índice semântico do projeto",
    "rag.reindex": "Reindexar",
    "rag.indexing": "indexando…",
    "rag.searchPlaceholder": "buscar por significado… (ex.: onde validamos permissões)",
    "rag.search": "Buscar",
    "rag.searching": "buscando…",
    "rag.hint": "Reindexe e busque trechos relevantes do repositório por significado.",
  },
  en: {
    "nav.projects": "Projects",
    "nav.sessions": "Sessions",
    "nav.new": "＋ New",
    "nav.config": "⚙ Settings",
    "header.chat": "chat / run",
    "ctx.project": "Project",
    "ctx.agent": "Agent",
    "ctx.mode": "Mode",
    "ctx.cost": "Cost",
    "ctx.bridge": "Bridge",
    "ctx.bridgeReady": "ready",
    "chat.empty": "Type a task to get the agent started.",
    "chat.placeholder": "type a task…  (Enter sends · Shift+Enter newline · @file for context)",
    "chat.running": "running…",
    "chat.bridgeUnavailable": "Bridge unavailable (window.polypus). Run via Electron.",
    "mode.plan.hint": "plans only, changes nothing",
    "mode.review.hint": "pauses for approval on every change",
    "mode.bypass.hint": "applies everything without asking",
    "settings.theme": "Theme",
    "settings.lang": "Language",
    "tab.chat": "Chat",
    "tab.rag": "Index (RAG)",
    "rag.title": "Project semantic index",
    "rag.reindex": "Reindex",
    "rag.indexing": "indexing…",
    "rag.searchPlaceholder": "search by meaning… (e.g. where do we validate permissions)",
    "rag.search": "Search",
    "rag.searching": "searching…",
    "rag.hint": "Reindex and search the repo for relevant chunks by meaning.",
  },
};

export function translate(lang: Lang, key: StringKey): string {
  return STRINGS[lang][key] ?? STRINGS["pt-BR"][key] ?? key;
}
