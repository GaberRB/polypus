import type { AgentConfig } from "../config/schema.js";
import { resolveSecret } from "../config/store.js";
import { AnthropicProvider } from "./anthropic.js";
import { DEFAULT_BASE_URL } from "./defaults.js";
import { OpenAICompatibleProvider } from "./openai-compatible.js";
import type { Provider } from "./types.js";
import { t } from "../i18n/index.js";

export type ResolvedToolMode = "native" | "emulated";

export interface ResolvedAgent {
  config: AgentConfig;
  provider: Provider;
  toolMode: ResolvedToolMode;
}

/**
 * Resolve `auto` to a concrete tool path. Cloud providers generally expose
 * function-calling, while local models (Ollama) are frequently base models
 * without it — so emulated is the safer default there. Users can force either
 * with `--tool-mode`.
 */
export function resolveToolMode(agent: AgentConfig): ResolvedToolMode {
  if (agent.toolMode !== "auto") return agent.toolMode;
  return agent.provider === "ollama" ? "emulated" : "native";
}

export function createProvider(agent: AgentConfig): ResolvedAgent {
  const apiKey = resolveSecret(agent.apiKey);
  const baseURL = agent.baseUrl ?? DEFAULT_BASE_URL[agent.provider];
  if (!baseURL) {
    throw new Error(t("agent.noBaseUrl", { name: agent.name }));
  }

  let provider: Provider;
  if (agent.provider === "anthropic") {
    if (!apiKey) throw new Error(t("agent.needAnthropicKey", { name: agent.name }));
    provider = new AnthropicProvider({
      name: agent.name,
      model: agent.model,
      baseURL,
      apiKey,
    });
  } else {
    provider = new OpenAICompatibleProvider({
      name: agent.name,
      model: agent.model,
      baseURL,
      apiKey,
    });
  }

  return { config: agent, provider, toolMode: resolveToolMode(agent) };
}
