import type { CustomProviderConfig } from "../config/schema.js";
import { query } from "../protocol/jsonpath.js";
import type { ChatRequest, ChatResponse, Provider } from "./types.js";

// ---------------------------------------------------------------------------
// Token cache
// ---------------------------------------------------------------------------

interface CachedToken {
  token: string;
  expiresAt: number; // ms since epoch; Infinity if no expiry info
}

class OAuth2Client {
  private cache: CachedToken | null = null;

  constructor(
    private readonly tokenUrl: string,
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly tokenPath: string,
    private readonly expiresPath: string | undefined,
  ) {}

  async getToken(): Promise<string> {
    const now = Date.now();
    if (this.cache && now < this.cache.expiresAt - 30_000) return this.cache.token;

    const res = await fetch(this.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });
    if (!res.ok) throw new Error(`Auth failed (${res.status}): ${await res.text()}`);
    const body = (await res.json()) as unknown;

    const token = query(body, this.tokenPath);
    if (typeof token !== "string" || !token) {
      throw new Error(`Token not found at path "${this.tokenPath}" in auth response`);
    }

    let expiresAt = Infinity;
    if (this.expiresPath) {
      const exp = query(body, this.expiresPath);
      if (typeof exp === "number" && exp > 0) expiresAt = now + exp * 1000;
    }

    this.cache = { token, expiresAt };
    return token;
  }
}

// ---------------------------------------------------------------------------
// Template substitution
// ---------------------------------------------------------------------------

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => vars[key.trim()] ?? `{{${key}}}`);
}

function buildVars(
  prompt: string,
  params: Record<string, string>,
  token?: string,
): Record<string, string> {
  const vars: Record<string, string> = { prompt };
  if (token) vars["auth.token"] = token;
  for (const [k, v] of Object.entries(params)) vars[`params.${k}`] = v;
  return vars;
}

// ---------------------------------------------------------------------------
// CustomProvider
// ---------------------------------------------------------------------------

export class CustomProvider implements Provider {
  readonly name: string;
  readonly model: string; // same as name — no model concept for custom providers

  private oauth2?: OAuth2Client;

  constructor(private readonly cfg: CustomProviderConfig) {
    this.name = cfg.name;
    this.model = cfg.name;

    if (cfg.auth.type === "oauth2-client-credentials") {
      this.oauth2 = new OAuth2Client(
        cfg.auth.tokenUrl,
        cfg.auth.clientId,
        cfg.auth.clientSecret,
        cfg.auth.tokenPath,
        cfg.auth.expiresPath,
      );
    }
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    // 1. Resolve token
    let token: string | undefined;
    if (this.cfg.auth.type === "oauth2-client-credentials") {
      token = await this.oauth2!.getToken();
    } else if (this.cfg.auth.type === "api-key") {
      token = resolveSecretValue(this.cfg.auth.apiKey);
    }

    // 2. Last user message as prompt
    const lastUser = [...req.messages].reverse().find((m) => m.role === "user");
    const prompt = lastUser?.content ?? "";

    // 3. Substitute template variables
    const vars = buildVars(prompt, this.cfg.params, token);
    const resolvedUrl = applyTemplate(this.cfg.chat.url, vars);
    const resolvedBody = applyTemplate(this.cfg.chat.bodyTemplate, vars);
    const resolvedHeaders: Record<string, string> = { "Content-Type": "application/json" };
    for (const [k, v] of Object.entries(this.cfg.chat.headers)) {
      resolvedHeaders[k] = applyTemplate(v, vars);
    }

    // Inject auth header if not already in custom headers
    if (token && this.cfg.auth.type === "api-key") {
      const headerName = this.cfg.auth.headerName;
      if (!resolvedHeaders[headerName]) resolvedHeaders[headerName] = token;
    } else if (token && this.cfg.auth.type === "oauth2-client-credentials") {
      if (!resolvedHeaders["Authorization"]) resolvedHeaders["Authorization"] = `Bearer ${token}`;
    }

    // 4. POST
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(resolvedBody);
    } catch {
      throw new Error(`Body template produced invalid JSON after substitution`);
    }

    const res = await fetch(resolvedUrl, {
      method: this.cfg.chat.method,
      headers: resolvedHeaders,
      body: JSON.stringify(parsedBody),
      signal: req.signal,
    });

    if (!res.ok) throw new Error(`Chat request failed (${res.status}): ${await res.text()}`);
    const data = (await res.json()) as unknown;

    // 5. Extract response text
    const content = query(data, this.cfg.responsePath);
    if (typeof content !== "string") {
      throw new Error(`Response not found at path "${this.cfg.responsePath}"`);
    }

    req.onDelta?.(content);

    return { content, toolCalls: [], finishReason: "stop" };
  }
}

/** Resolve "${ENV_VAR}" references in stored credential values. */
function resolveSecretValue(value: string): string {
  const match = /^\$\{([A-Z0-9_]+)\}$/i.exec(value.trim());
  if (match) {
    const env = process.env[match[1]!];
    if (!env) throw new Error(`Env var ${match[1]} is not set`);
    return env;
  }
  return value;
}
