/** Sistema de permissão para ações web */

export type PermissionMode = "plan" | "review" | "bypass";

/** Ações mutantes (modificam a página) vs. apenas leitura */
const MUTATING_ACTIONS = new Set(["web_click", "web_type", "web_execute"]);

export interface WebPermissions {
  mode: PermissionMode;
  allowList: string[];
  blockList: string[];
}

export function defaultPermissions(): WebPermissions {
  return {
    mode: "review",
    allowList: [],
    blockList: [],
  };
}

/** Verifica se uma URL está na allow-list e não está na block-list */
export function isUrlAllowed(url: string, perms: WebPermissions): boolean {
  try {
    const u = new URL(url);
    // Block-list tem precedência
    for (const block of perms.blockList) {
      if (matchDomain(u.hostname, block)) return false;
    }
    // Se allow-list está vazia, permite tudo
    if (perms.allowList.length === 0) return true;
    for (const allow of perms.allowList) {
      if (matchDomain(u.hostname, allow)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Verifica se uma ação é permitida no modo atual */
export function isActionAllowed(actionName: string, mode: PermissionMode): boolean {
  if (mode === "plan") {
    // Em modo plan, apenas ações de leitura
    return !MUTATING_ACTIONS.has(actionName);
  }
  return true; // review e bypass permitem tudo (review pede confirmação)
}

/** Match simples de domínio com suporte a glob (*) */
function matchDomain(hostname: string, pattern: string): boolean {
  if (pattern === "*" || pattern === "*.*") return true;
  const parts = pattern.split(".");
  const hostParts = hostname.split(".");
  if (parts.length > hostParts.length) return false;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[parts.length - 1 - i]!;
    const h = hostParts[hostParts.length - 1 - i]!;
    if (p === "*") continue;
    if (p !== h) return false;
  }
  return true;
}

/** Nome amigável de uma ação web (i18n key) */
export function actionLabelKey(action: string): string {
  const map: Record<string, string> = {
    web_navigate: "web.navigate",
    web_click: "web.click",
    web_type: "web.type",
    web_extract: "web.extract",
    web_scroll: "web.scroll",
    web_screenshot: "web.screenshot",
    web_getHtml: "web.getHtml",
    web_wait: "web.wait",
  };
  return map[action] ?? action;
}