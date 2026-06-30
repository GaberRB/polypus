/**
 * Screenshot optimizer — captura e comprime screenshots para usar como
 * contexto visual em modelos com visão.
 *
 * Para modelos COM visão: envia screenshot JPEG comprimido (qualidade 80%,
 * max 1280px de largura) + structured data dos elementos interativos.
 *
 * Para modelos SEM visão: extrai apenas texto + elementos interativos
 * (links, buttons, inputs) como JSON estruturado.
 */

export interface ScreenshotResult {
  dataUrl?: string;
  width?: number;
  height?: number;
  /** Texto extraído como fallback (para modelos sem visão) */
  textContent?: string;
  /** Elementos interativos identificados */
  interactiveElements?: InteractiveElement[];
}

export interface InteractiveElement {
  tag: string;
  type?: string;
  text?: string;
  href?: string;
  selector: string;
  rect: { x: number; y: number; width: number; height: number };
}

const MAX_WIDTH = 1280;
const JPEG_QUALITY = 0.8;

/**
 * Comprime uma dataUrl de screenshot para JPEG com qualidade 80% e
 * redimensiona se exceder MAX_WIDTH de largura.
 */
export function compressScreenshot(dataUrl: string): Promise<ScreenshotResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth;
      let h = img.naturalHeight;

      // Redimensionar se necessário
      if (w > MAX_WIDTH) {
        h = Math.round(h * (MAX_WIDTH / w));
        w = MAX_WIDTH;
      }

      // Desenhar em canvas e comprimir
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get 2D context"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const compressed = canvas.toDataURL("image/jpeg", JPEG_QUALITY);

      resolve({
        dataUrl: compressed,
        width: w,
        height: h,
      });
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });
}

/**
 * Extrai elementos interativos da página (links, botões, inputs)
 * como structured data, incluindo seletores CSS únicos aproximados.
 */
export function extractInteractiveElements(): InteractiveElement[] {
  const elements: InteractiveElement[] = [];

  // Links
  document.querySelectorAll("a[href]").forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    elements.push({
      tag: "a",
      text: (el.textContent ?? "").trim().slice(0, 60),
      href: (el as HTMLAnchorElement).href,
      selector: buildSelector(el),
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    });
  });

  // Buttons
  document.querySelectorAll("button, [role=button], input[type=submit], input[type=button]").forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    elements.push({
      tag: el.tagName.toLowerCase(),
      type: (el as HTMLElement).getAttribute("type") ?? undefined,
      text: ((el as HTMLElement).textContent ?? "").trim().slice(0, 60) ||
            (el as HTMLInputElement).value?.slice(0, 60),
      selector: buildSelector(el),
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    });
  });

  // Inputs
  document.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button]), textarea, select").forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const input = el as HTMLInputElement;
    elements.push({
      tag: el.tagName.toLowerCase(),
      type: input.type ?? "text",
      text: (input.placeholder || input.name || (el as HTMLElement).textContent ?? "").trim().slice(0, 60),
      selector: buildSelector(el),
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    });
  });

  return elements;
}

/**
 * Constrói um seletor CSS aproximado para um elemento,
 * usando id, classes e tag name.
 */
function buildSelector(el: Element): string {
  if (el.id) return `#${el.id}`;
  const tag = el.tagName.toLowerCase();
  const classes = Array.from(el.classList).slice(0, 3).map((c) => `.${CSS.escape(c)}`).join("");
  if (classes) return `${tag}${classes}`;
  // Fallback: nth-child
  const parent = el.parentElement;
  if (parent) {
    const idx = Array.from(parent.children).indexOf(el as HTMLElement) + 1;
    return `${tag}:nth-child(${idx})`;
  }
  return tag;
}

/**
 * Decide se o modelo suporta visão baseado no nome do modelo.
 * Heurística simples — modelos conhecidos de visão.
 */
const VISION_MODELS = new Set([
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-4-vision",
  "claude-3-opus",
  "claude-3-sonnet",
  "claude-3-haiku",
  "claude-3.5-sonnet",
  "gemini-pro-vision",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "llava",
  "cogvlm",
  "qwen-vl",
]);

export function modelSupportsVision(modelId: string): boolean {
  const id = modelId.toLowerCase();
  for (const vm of VISION_MODELS) {
    if (id.includes(vm)) return true;
  }
  // Modelos que contêm "vision", "vl", "multimodal" no nome
  if (/vision|vl(-|$)|multimodal/.test(id)) return true;
  return false;
}