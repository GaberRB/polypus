/**
 * Parse a cURL command string into its components.
 * Supports: -X, -H, -d / --data / --data-raw / --data-urlencode, -u, --url, URL positional.
 */

export interface CurlResult {
  url: string;
  method: string;
  headers: Record<string, string>;
  /** Raw body string (JSON, form data, etc.) */
  body: string | null;
  /** True when body is application/x-www-form-urlencoded (detected from -d key=val or Content-Type header) */
  isFormEncoded: boolean;
}

export function parseCurl(raw: string): CurlResult {
  // Normalize: remove line continuations and collapse whitespace
  const input = raw
    .replace(/\\\n/g, " ")
    .replace(/\\\r\n/g, " ")
    .trim();

  const tokens = tokenise(input);
  let url = "";
  let method = "POST";
  const headers: Record<string, string> = {};
  const bodyParts: string[] = [];
  let isFormEncoded = false;

  let i = 1; // skip "curl"
  while (i < tokens.length) {
    const tok = tokens[i]!;

    if (tok === "-X" || tok === "--request") {
      method = tokens[++i] ?? method;
    } else if (tok === "-H" || tok === "--header") {
      const h = tokens[++i] ?? "";
      const colon = h.indexOf(":");
      if (colon !== -1) {
        const name = h.slice(0, colon).trim();
        const value = h.slice(colon + 1).trim();
        headers[name] = value;
        if (name.toLowerCase() === "content-type" && value.includes("x-www-form-urlencoded")) {
          isFormEncoded = true;
        }
      }
    } else if (tok === "-d" || tok === "--data" || tok === "--data-raw" || tok === "--data-ascii") {
      bodyParts.push(tokens[++i] ?? "");
    } else if (tok === "--data-urlencode") {
      const part = tokens[++i] ?? "";
      bodyParts.push(part.includes("=") ? part : `${part}=`);
      isFormEncoded = true;
    } else if (tok === "-u" || tok === "--user") {
      const creds = tokens[++i] ?? "";
      headers["Authorization"] = `Basic ${btoa(creds)}`;
    } else if (tok === "--url") {
      url = tokens[++i] ?? "";
    } else if (!tok.startsWith("-") && !url) {
      url = tok;
    }
    i++;
  }

  // If no -X but body data present, default to POST
  if (bodyParts.length > 0 && method === "POST") method = "POST";
  // If no -X and no body, likely GET
  if (bodyParts.length === 0 && !tokens.some((t) => t === "-X" || t === "--request")) {
    method = "GET";
  }

  // Detect form-encoded by body content (key=value&key=value, no braces)
  const rawBody = bodyParts.join("&") || null;
  if (rawBody && !rawBody.trim().startsWith("{") && rawBody.includes("=")) {
    isFormEncoded = true;
  }

  return { url, method, headers, body: rawBody, isFormEncoded };
}

/** Tokenise a shell-like command line respecting single and double quotes. */
function tokenise(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let i = 0;
  while (i < input.length) {
    const ch = input[i]!;
    if (ch === "'") {
      i++;
      while (i < input.length && input[i] !== "'") current += input[i++];
      i++; // closing quote
    } else if (ch === '"') {
      i++;
      while (i < input.length && input[i] !== '"') {
        if (input[i] === "\\" && i + 1 < input.length) { i++; current += input[i++]; }
        else current += input[i++];
      }
      i++;
    } else if (ch === " " || ch === "\t") {
      if (current) { tokens.push(current); current = ""; }
      i++;
    } else {
      current += ch;
      i++;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}
