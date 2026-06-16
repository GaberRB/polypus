import type { ProviderKind } from "../config/schema.js";

/** Default base URL per provider. `openai-compatible` has none — the user must supply one. */
export const DEFAULT_BASE_URL: Record<ProviderKind, string | undefined> = {
  openrouter: "https://openrouter.ai/api/v1",
  ollama: "http://localhost:11434/v1",
  "openai-compatible": undefined,
  anthropic: "https://api.anthropic.com",
};

/** Whether a provider typically requires an API key (local Ollama does not). */
export const REQUIRES_API_KEY: Record<ProviderKind, boolean> = {
  openrouter: true,
  ollama: false,
  "openai-compatible": false,
  anthropic: true,
};

/** Conventional env var name to suggest for a provider's key during setup. */
export const SUGGESTED_KEY_ENV: Record<ProviderKind, string | undefined> = {
  openrouter: "OPENROUTER_API_KEY",
  ollama: undefined,
  "openai-compatible": "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};
