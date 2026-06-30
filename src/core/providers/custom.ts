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

interface OAuth2Options {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  grantType: string;
  tokenHeaders: Record<string, string>;
  tokenParams: Record<string, string>;
  tokenPath: string;
  expiresPath: string | undefined;
}

class OAuth2Client {
  private cache: CachedToken | null = null;

  constructor(private readonly opts: OAuth2Options) {}

  async getToken(): Promise<string> {
    const now = Date.now();
    if (this.cache && now < this.cache.expiresAt - 30_000) return this.cache.token;

    const { tokenUrl, clientId, clientSecret, grantType, tokenHeaders, tokenParams, tokenPath, expiresPath } = this.opts;
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...tokenHeaders,
      },
      body: new URLSearchParams({
        grant_type: grantType,
        client_id: clientId,
        client_secret: clientSecret,
        ...tokenParams,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Auth failed (${res.status}): ${body}`);
    }
    const body = (await res.json()) as unknown;

    const token = query(body, this.opts.tokenPath);
    if (typeof token !== "string" || !token) {
      throw new Error(`Token not found at path "${this.opts.tokenPath}" in auth response`);
    }

    let expiresAt = Infinity;
    if (this.opts.expiresPath) {
      const exp = query(body, this.opts.expiresPath);
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

/**
 * Same as applyTemplate but JSON-escapes each substituted value so the result
 * is safe to embed inside a JSON string literal. Use for bodyTemplate only.
 * e.g. prompt = `say "hi"` → `say \"hi\"` inside the JSON body.
 */
function applyJsonTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
    const val = vars[key.trim()];
    if (val === undefined) return `{{${key}}}`;
    // JSON.stringify escapes quotes, backslashes, control chars; strip the outer quotes.
    return JSON.stringify(val).slice(1, -1);
  });
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
      this.oauth2 = new OAuth2Client({
        tokenUrl: cfg.auth.tokenUrl,
        clientId: cfg.auth.clientId,
        clientSecret: cfg.auth.clientSecret,
        grantType: cfg.auth.grantType,
        tokenHeaders: cfg.auth.tokenHeaders,
        tokenParams: cfg.auth.tokenParams,
        tokenPath: cfg.auth.tokenPath,
        expiresPath: cfg.auth.expiresPath,
      });
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
    const resolvedBody = applyJsonTemplate(this.cfg.chat.bodyTemplate, vars);
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
