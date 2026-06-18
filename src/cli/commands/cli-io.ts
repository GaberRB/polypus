import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { t } from "../../core/i18n/index.js";

/** Max chars of project guide files fed to the PRD/review bots (keeps prompts bounded). */
const GUIDE_MAX = 12_000;

/**
 * Read project guide files (e.g. `context.md`, `rules.md`) from the workspace
 * to ground the PRD/review bots. Returns undefined when none exist, and caps the
 * combined size so a large file can't blow the model's context window.
 */
export function readProjectGuide(files: string[]): string | undefined {
  const parts: string[] = [];
  for (const file of files) {
    try {
      const path = resolve(process.cwd(), file);
      if (existsSync(path)) parts.push(`# ${file}\n${readFileSync(path, "utf8").trim()}`);
    } catch {
      /* ignore unreadable files */
    }
  }
  if (parts.length === 0) return undefined;
  const joined = parts.join("\n\n");
  return joined.length > GUIDE_MAX ? joined.slice(0, GUIDE_MAX) + "\n…(truncated)" : joined;
}

/** Strip a leading `#` and assert the ref is a bare issue/PR number. */
export function numericRef(ref: string): string {
  const num = ref.replace(/^#/, "");
  if (!/^\d+$/.test(num)) throw new Error(t("cli.invalidRef", { ref }));
  return num;
}

/**
 * Read all of stdin as UTF-8. Fails fast when stdin is a TTY (i.e. `--input -`
 * was passed with no pipe), which would otherwise hang waiting for input.
 */
export async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) throw new Error(t("cli.stdinTty"));
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/** Drop a leading UTF-8 BOM that some shells/files prepend, which breaks JSON.parse. */
export function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}
