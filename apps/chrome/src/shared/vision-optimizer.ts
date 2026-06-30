/**
 * Vision optimizer — decide como fornecer contexto visual baseado no modelo.
 *
 * Se modelo COM visão: envia screenshot comprimido + structured data
 * Se modelo SEM visão: extrai texto + elementos interativos como JSON
 */
import {
  compressScreenshot,
  extractInteractiveElements,
  modelSupportsVision,
  type ScreenshotResult,
} from "../content/screenshot.js";

export interface VisionContext {
  hasVision: boolean;
  screenshot?: ScreenshotResult;
  structuredContent: string;
}

/**
 * Prepara o contexto visual para o modelo.
 * @param modelId ID do modelo (ex.: "anthropic/claude-3.5-sonnet")
 * @param dataUrl Screenshot dataUrl (opcional, capturado pelo background)
 */
export async function prepareVisionContext(
  modelId: string,
  dataUrl?: string,
): Promise<VisionContext> {
  const hasVision = modelSupportsVision(modelId);
  const elements = extractInteractiveElements();
  const pageText = document.body.innerText.slice(0, 50000);

  let screenshot: ScreenshotResult | undefined;
  if (hasVision && dataUrl) {
    screenshot = await compressScreenshot(dataUrl);
  }

  // Structured content como fallback / complemento
  const interactiveJson = elements.slice(0, 100).map((el) => ({
    tag: el.tag,
    type: el.type,
    text: el.text,
    href: el.href,
    selector: el.selector,
  }));

  const structuredContent = JSON.stringify(
    {
      pageText: pageText.slice(0, 30000),
      elements: interactiveJson,
      elementCount: elements.length,
      url: location.href,
      title: document.title,
    },
    null,
    2,
  );

  return {
    hasVision,
    screenshot,
    structuredContent,
  };
}