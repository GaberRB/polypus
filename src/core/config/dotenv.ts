import { existsSync, readFileSync } from "node:fs";

/**
 * Minimal .env loader. Reads simple KEY=VALUE lines and sets them on
 * process.env *without* overriding variables already present in the real
 * environment. This lets Polypus pick up keys (e.g. OPENROUTER_API_KEY) from
 * ~/.polypus/.env regardless of how the OS propagates user env vars to shells.
 */
export function loadDotenv(paths: string[]): void {
  for (const path of paths) {
    if (!existsSync(path)) continue;
    let text: string;
    try {
      text = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  }
}
