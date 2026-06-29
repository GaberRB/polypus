import type { CustomProviderConfig } from "../config/schema.js";
import { CustomProvider } from "./custom.js";

export interface CustomProviderTestResult {
  ok: boolean;
  message: string;
  /** The raw text extracted from the response, if successful. */
  reply?: string;
}

/**
 * Run a real end-to-end connectivity test against a custom provider config.
 * Sends "Oi" as a test prompt and verifies the JSONPath can extract a reply.
 */
export async function testCustomProvider(
  cfg: CustomProviderConfig,
): Promise<CustomProviderTestResult> {
  const provider = new CustomProvider(cfg);
  try {
    const res = await provider.chat({
      messages: [{ role: "user", content: "Oi" }],
    });
    return { ok: true, message: "Conexão bem-sucedida!", reply: res.content };
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    // Surface auth errors distinctly
    if (msg.includes("Auth failed") || msg.includes("401")) {
      return { ok: false, message: `❌ Falha na autenticação: ${msg}` };
    }
    if (msg.includes("not found at path")) {
      return { ok: false, message: `❌ JSONPath inválido: ${msg}` };
    }
    return { ok: false, message: `❌ ${msg}` };
  }
}
