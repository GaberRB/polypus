import { writeFile, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import pc from "picocolors";
import { reviewDiff, type PrMeta } from "../../core/agent/review.js";
import { resolveFreeProvider, DEFAULT_REVIEW_MODEL, withRetry } from "../../core/agent/free-provider.js";
import { t } from "../../core/i18n/index.js";

const exec = promisify(execFile);

export interface ReviewCliOptions {
  out?: string;
  model?: string;
  /** Read the diff from a file (or "-" for stdin) instead of calling gh. */
  input?: string;
}

/** `polypus review <pr#>` — review a PR diff with a free model (non-interactive). */
export async function review(prRef: string, opts: ReviewCliOptions): Promise<void> {
  const num = prRef.replace(/^#/, "");
  const diff = await loadDiff(num, opts.input);
  const meta = await loadMeta(num, opts.input);
  const { provider } = resolveFreeProvider(opts.model ?? DEFAULT_REVIEW_MODEL);

  const markdown = await withRetry(() => reviewDiff(diff, meta, provider));

  if (opts.out) {
    await writeFile(opts.out, markdown + "\n", "utf8");
    console.error(pc.green(t("review.wrote", { path: opts.out })));
  } else {
    process.stdout.write(markdown + "\n");
  }
}

/** Diff from --input (file/stdin) or `gh pr diff`. */
async function loadDiff(num: string, input?: string): Promise<string> {
  if (input) return input === "-" ? readStdin() : readFile(input, "utf8");
  const { stdout } = await exec("gh", ["pr", "diff", num]);
  return stdout;
}

/** PR title/body from `gh pr view`; skipped (placeholder) when reading --input. */
async function loadMeta(num: string, input?: string): Promise<PrMeta> {
  if (input) return { number: Number(num) || undefined, title: `PR ${num}`, body: "" };
  const { stdout } = await exec("gh", ["pr", "view", num, "--json", "number,title,body"]);
  const raw = JSON.parse(stdout) as { number?: number; title?: string; body?: string };
  return { number: raw.number, title: raw.title ?? "", body: raw.body ?? "" };
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}
