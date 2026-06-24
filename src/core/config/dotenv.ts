import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { configDir } from "./store.js";

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

/**
 * Upsert a single `NAME=value` line in a .env file (default `~/.polypus/.env`),
 * preserving the other lines/comments. Creates the file (and dir) if missing.
 * Used by host UIs (e.g. Cowork) to persist API keys outside config.json.
 */
export async function setEnvVar(
  name: string,
  value: string,
  file: string = join(configDir(), ".env"),
): Promise<void> {
  let lines: string[] = [];
  try {
    lines = (await readFile(file, "utf8")).split(/\r?\n/);
  } catch {
    /* new file */
  }
  const rendered = `${name}=${/\s/.test(value) ? `"${value}"` : value}`;
  let replaced = false;
  const out = lines.map((line) => {
    const trimmed = line.trim();
    if (!replaced && trimmed && !trimmed.startsWith("#")) {
      const eq = trimmed.indexOf("=");
      if (eq !== -1 && trimmed.slice(0, eq).trim() === name) {
        replaced = true;
        return rendered;
      }
    }
    return line;
  });
  if (!replaced) {
    while (out.length && out[out.length - 1]!.trim() === "") out.pop();
    out.push(rendered);
  }
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, out.join("\n").replace(/\n*$/, "\n"), "utf8");
}
