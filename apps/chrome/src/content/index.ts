/**
 * Content Script — injetado na página ativa para executar ações web.
 *
 * Expõe funções via `window.__polypus` e responde a mensagens do
 * service worker via `chrome.runtime.onMessage`.
 *
 * As ações disponíveis:
 *   navigate(url)    → Navega para URL
 *   extract(selector?) → Extrai texto da página
 *   scroll(direction) → Rola a página
 *   screenshot()     → Captura screenshot (delega ao background)
 *   getHtml()        → Obtém HTML completo
 *   wait(ms)         → Aguarda
 *   click(selector)  → Clica em elemento
 *   type(selector, text) → Digita em input
 *   execute(code)    → Executa JS arbitrário
 */
import type { StreamEvent } from "../shared/types.js";

/* ─── Helpers ─── */

function waitForPageLoad(): Promise<void> {
  return new Promise((resolve) => {
    if (document.readyState === "complete") return resolve();
    window.addEventListener("load", () => resolve(), { once: true });
  });
}

function findElement(selector: string): Element | null {
  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}

/* ─── Ações ─── */

async function actionNavigate(url: string): Promise<{ ok: boolean; output: string }> {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return { ok: false, output: `Invalid protocol: ${u.protocol}` };
    }
    window.location.href = url;
    await waitForPageLoad();
    return { ok: true, output: `✓ Navigated to ${url}` };
  } catch (err) {
    return { ok: false, output: `Navigate failed: ${(err as Error).message}` };
  }
}

async function actionExtract(selector?: string): Promise<{ ok: boolean; output: string }> {
  try {
    if (selector) {
      const el = findElement(selector);
      if (!el) return { ok: false, output: `Element not found: ${selector}` };
      return { ok: true, output: el.textContent?.trim() ?? "" };
    }
    return { ok: true, output: document.body.innerText.slice(0, 100000) };
  } catch (err) {
    return { ok: false, output: `Extract failed: ${(err as Error).message}` };
  }
}

async function actionScroll(direction: string): Promise<{ ok: boolean; output: string }> {
  try {
    const opts: ScrollToOptions = { behavior: "smooth" };
    switch (direction) {
      case "up":
        opts.top = Math.max(0, window.scrollY - window.innerHeight * 0.8);
        break;
      case "down":
        opts.top = window.scrollY + window.innerHeight * 0.8;
        break;
      case "top":
        opts.top = 0;
        break;
      case "bottom":
        opts.top = document.body.scrollHeight;
        break;
    }
    window.scrollTo(opts);
    return { ok: true, output: `✓ Scrolled ${direction}` };
  } catch (err) {
    return { ok: false, output: `Scroll failed: ${(err as Error).message}` };
  }
}

async function actionScreenshot(): Promise<{ ok: boolean; output: string }> {
  // Screenshot via chrome.tabs.captureVisibleTab é feito pelo background
  // Aqui apenas retornamos um placeholder — o background lida com a captura
  return { ok: false, output: "Screenshot must be triggered from the service worker via chrome.tabs.captureVisibleTab." };
}

async function actionGetHtml(): Promise<{ ok: boolean; output: string }> {
  try {
    return { ok: true, output: document.documentElement.outerHTML.slice(0, 200000) };
  } catch (err) {
    return { ok: false, output: `getHtml failed: ${(err as Error).message}` };
  }
}

async function actionClick(selector: string): Promise<{ ok: boolean; output: string }> {
  try {
    const el = findElement(selector);
    if (!el) return { ok: false, output: `Element not found: ${selector}` };
    (el as HTMLElement).click();
    return { ok: true, output: `✓ Clicked ${selector}` };
  } catch (err) {
    return { ok: false, output: `Click failed: ${(err as Error).message}` };
  }
}

async function actionType(selector: string, text: string): Promise<{ ok: boolean; output: string }> {
  try {
    const el = findElement(selector);
    if (!el) return { ok: false, output: `Element not found: ${selector}` };
    const input = el as HTMLInputElement | HTMLTextAreaElement;
    if (typeof input.value !== "string") return { ok: false, output: `Element is not an input: ${selector}` };
    input.value = text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true, output: `✓ Typed into ${selector}` };
  } catch (err) {
    return { ok: false, output: `Type failed: ${(err as Error).message}` };
  }
}

async function actionExecute(code: string): Promise<{ ok: boolean; output: string }> {
  try {
    // eslint-disable-next-line no-eval
    const result = eval(code);
    return { ok: true, output: String(result) };
  } catch (err) {
    return { ok: false, output: `Execute failed: ${(err as Error).message}` };
  }
}

async function actionWait(ms: number): Promise<{ ok: boolean; output: string }> {
  await new Promise((r) => setTimeout(r, ms));
  return { ok: true, output: `✓ Waited ${ms}ms` };
}

/* ─── Router de mensagens ─── */

chrome.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
  const m = msg as { type?: string; action?: string; args?: Record<string, unknown> };
  if (m.type !== "web_action") return false;

  const run = async (): Promise<void> => {
    const args = m.args ?? {};
    switch (m.action) {
      case "navigate":
        sendResponse(await actionNavigate(args.url as string));
        break;
      case "extract":
        sendResponse(await actionExtract(args.selector as string | undefined));
        break;
      case "scroll":
        sendResponse(await actionScroll(args.direction as string));
        break;
      case "screenshot":
        sendResponse(await actionScreenshot());
        break;
      case "getHtml":
        sendResponse(await actionGetHtml());
        break;
      case "click":
        sendResponse(await actionClick(args.selector as string));
        break;
      case "type":
        sendResponse(await actionType(args.selector as string, args.text as string));
        break;
      case "execute":
        sendResponse(await actionExecute(args.code as string));
        break;
      case "wait":
        sendResponse(await actionWait(Number(args.ms ?? 500)));
        break;
      default:
        sendResponse({ ok: false, output: `Unknown action: ${m.action}` });
    }
  };

  run();
  return true; // keep channel open for async response
});

/* ─── Status para debug ─── */

console.log("🐙 Polypus content script loaded");
(window as unknown as Record<string, unknown>).__polypus = {
  ready: true,
  url: location.href,
};