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

/** Display label for each auth type in the custom-provider wizard. */
export const CUSTOM_AUTH_LABELS = {
  none: "Sem autenticação",
  "api-key": "API Key (Header)",
  "oauth2-client-credentials": "OAuth2 — Client Credentials (2 chamadas)",
} as const;

/** One-line explanation shown to the user when selecting an auth type. */
export const CUSTOM_AUTH_DESCRIPTION = {
  none: "A API é aberta — basta enviar o request direto.",
  "api-key": "Uma chave fixa é enviada em um header a cada chamada.",
  "oauth2-client-credentials":
    "Primeiro busca um token de acesso (POST /token), depois usa no header do chat. O token é renovado automaticamente quando expira.",
} as const;
