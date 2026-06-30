/** i18n minimal para a extensão Chrome — pt-BR + en */

export const LOCALES = ["pt-BR", "en"] as const;
export type Locale = (typeof LOCALES)[number];

type Catalog = Record<string, string>;

const en: Catalog = {
  "app.name": "Polypus Web Agent",
  "popup.activate": "Activate Polypus",
  "popup.taskPlaceholder": "What should the agent do in this page?",
  "popup.send": "Send",
  "popup.openPanel": "Open Side Panel",
  "popup.status.connected": "Connected",
  "popup.status.connecting": "Connecting…",
  "popup.status.disconnected": "Disconnected",
  "popup.status.error": "Connection error",
  "popup.noCli": "Polypus CLI not found. Run `polypus web-server` in your terminal.",
  "popup.resume": "Resume previous session",
  "panel.placeholder": "Ask the agent to do something on this page.\nE.g.: \"Extract all links and save as CSV\"",
  "panel.send": "Send",
  "panel.stop": "Stop",
  "panel.thinking": "thinking…",
  "panel.running": "running {tool}",
  "panel.done": "✓ Done ({steps} steps)",
  "panel.error": "✗ Error: {msg}",
  "panel.planMode": "Plan mode — read only",
  "panel.reviewMode": "Review mode — approve each action",
  "panel.bypassMode": "Bypass mode — auto-approve",
  "timeline.title": "Actions",
  "timeline.empty": "No actions yet",
  "confirm.title": "Allow action?",
  "confirm.approve": "Approve",
  "confirm.reject": "Reject",
  "confirm.action": "Polypus wants to: {action}",
  "confirm.target": "on element: {target}",
  "confirm.page": "on page: {url}",
  "usage.tokens": "{total} tokens",
  "usage.cost": "~{cost}",
  "permission.mode": "Permission mode",
  "permission.plan": "Plan",
  "permission.review": "Review",
  "permission.bypass": "Bypass",
  "permission.allowList": "Allowed domains",
  "permission.blockList": "Blocked domains",
  "permission.addDomain": "Add domain…",
  "web.navigate": "Navigate to {url}",
  "web.click": "Click on {selector}",
  "web.type": "Type into {selector}",
  "web.extract": "Extract text from page",
  "web.scroll": "Scroll {direction}",
  "web.screenshot": "Take screenshot",
  "web.getHtml": "Read page HTML",
  "web.wait": "Wait {ms}ms",
};

const ptBR: Catalog = {
  "app.name": "Polypus Web Agent",
  "popup.activate": "Ativar Polypus",
  "popup.taskPlaceholder": "O que o agente deve fazer nesta página?",
  "popup.send": "Enviar",
  "popup.openPanel": "Abrir Painel",
  "popup.status.connected": "Conectado",
  "popup.status.connecting": "Conectando…",
  "popup.status.disconnected": "Desconectado",
  "popup.status.error": "Erro de conexão",
  "popup.noCli": "CLI Polypus não encontrado. Rode `polypus web-server` no terminal.",
  "popup.resume": "Retomar sessão anterior",
  "panel.placeholder": "Peça para o agente fazer algo nesta página.\nEx.: \"Extraia todos os links e salve como CSV\"",
  "panel.send": "Enviar",
  "panel.stop": "Parar",
  "panel.thinking": "pensando…",
  "panel.running": "executando {tool}",
  "panel.done": "✓ Concluído ({steps} passos)",
  "panel.error": "✗ Erro: {msg}",
  "panel.planMode": "Modo plano — somente leitura",
  "panel.reviewMode": "Modo revisão — aprovar cada ação",
  "panel.bypassMode": "Modo bypass — aprovar automaticamente",
  "timeline.title": "Ações",
  "timeline.empty": "Nenhuma ação ainda",
  "confirm.title": "Permitir ação?",
  "confirm.approve": "Aprovar",
  "confirm.reject": "Rejeitar",
  "confirm.action": "Polypus quer: {action}",
  "confirm.target": "no elemento: {target}",
  "confirm.page": "na página: {url}",
  "usage.tokens": "{total} tokens",
  "usage.cost": "~{cost}",
  "permission.mode": "Modo de permissão",
  "permission.plan": "Plano",
  "permission.review": "Revisão",
  "permission.bypass": "Bypass",
  "permission.allowList": "Domínios permitidos",
  "permission.blockList": "Domínios bloqueados",
  "permission.addDomain": "Adicionar domínio…",
  "web.navigate": "Navegar para {url}",
  "web.click": "Clicar em {selector}",
  "web.type": "Digitar em {selector}",
  "web.extract": "Extrair texto da página",
  "web.scroll": "Rolar {direction}",
  "web.screenshot": "Tirar screenshot",
  "web.getHtml": "Ler HTML da página",
  "web.wait": "Aguardar {ms}ms",
};

const CATALOGS: Record<Locale, Catalog> = { en, "pt-BR": ptBR };

let currentLocale: Locale = "pt-BR";

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: string, params?: Record<string, string | number>): string {
  const template = CATALOGS[currentLocale][key] ?? en[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in params ? String(params[name]) : `{${name}}`,
  );
}

export function detectLocale(): Locale {
  const lang = navigator.language;
  if (lang.startsWith("pt")) return "pt-BR";
  return "en";
}