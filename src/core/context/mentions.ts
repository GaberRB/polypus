import { readdir, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { checkPath, type PathPolicy } from "../permissions/allowlist.js";
import { t } from "../i18n/index.js";

/** Max characters injected per referenced file (truncated beyond this). */
const MAX_FILE_CHARS = 10_000;

/**
 * Matches `@path` mentions: an `@` at the start or after whitespace, followed by
 * a path-like token (letters, digits, `. / _ -`). A trailing `/` marks a directory.
 */
const MENTION_RE = /(?:^|\s)@([\w./-]+)/g;

export interface MentionResult {
  /** The task text with a "Referenced files" block appended (unchanged if no valid mentions). */
  task: string;
  /** Workspace-relative paths that were resolved and injected. */
  injected: string[];
}

/**
 * Resolve `@file` / `@dir/` mentions in a task and append their contents/listing
 * as explicit context. Paths are resolved against the allow-list; missing or
 * denied ones are skipped (noted inline). `@symbol` lookups are out of scope
 * until a repository index exists.
 */
export async function resolveMentions(task: string, policy: PathPolicy): Promise<MentionResult> {
  const tokens = [...task.matchAll(MENTION_RE)].map((m) => m[1]!);
  const unique = [...new Set(tokens)];
  if (unique.length === 0) return { task, injected: [] };

  const blocks: string[] = [];
  const injected: string[] = [];

  for (const token of unique) {
    const decision = checkPath(policy, token);
    if (!decision.allowed) {
      blocks.push(`## @${token}\n${t("mentions.notFound", { path: token })}`);
      continue;
    }
    const abs = resolve(policy.workspace, token);
    try {
      const info = await stat(abs);
      if (info.isDirectory()) {
        const entries = await readdir(abs, { withFileTypes: true });
        const listing = entries
          .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
          .sort()
          .join("\n");
        blocks.push(`## ${t("mentions.dirHeader", { path: decision.rel })}\n${listing || "(empty)"}`);
        injected.push(decision.rel);
      } else {
        const raw = await readFile(abs, "utf8");
        const content = raw.length > MAX_FILE_CHARS ? raw.slice(0, MAX_FILE_CHARS) + "\n…[truncated]" : raw;
        blocks.push(`## @${decision.rel}\n\`\`\`\n${content}\n\`\`\``);
        injected.push(decision.rel);
      }
    } catch {
      blocks.push(`## @${token}\n${t("mentions.notFound", { path: token })}`);
    }
  }

  if (injected.length === 0) return { task, injected: [] };

  const augmented = `${task}\n\n--- ${t("mentions.injectedHeader")} ---\n\n${blocks.join("\n\n")}`;
  return { task: augmented, injected };
}
