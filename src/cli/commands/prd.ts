import { writeFile, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import pc from "picocolors";
import { generatePrd, type IssueInput } from "../../core/agent/prd.js";
import { resolveFreeProvider, DEFAULT_PRD_MODEL, withRetry } from "../../core/agent/free-provider.js";
import { numericRef, readStdin, stripBom } from "./cli-io.js";
import { t } from "../../core/i18n/index.js";

const exec = promisify(execFile);

export interface PrdCliOptions {
  out?: string;
  model?: string;
  /** Read the issue JSON from a file (or "-" for stdin) instead of calling gh. */
  input?: string;
}

/** `polypus prd <issue#>` — generate a PRD from a GitHub issue (non-interactive). */
export async function prd(issueRef: string, opts: PrdCliOptions): Promise<void> {
  const issue = await loadIssue(issueRef, opts.input);
  const { provider } = resolveFreeProvider(opts.model ?? DEFAULT_PRD_MODEL);

  const markdown = await withRetry(() => generatePrd(issue, provider));

  if (opts.out) {
    await writeFile(opts.out, markdown + "\n", "utf8");
    console.error(pc.green(t("prd.wrote", { path: opts.out })));
  } else {
    process.stdout.write(markdown + "\n");
  }
}

/** Load the issue from --input (JSON file/stdin) or by shelling out to `gh`. */
async function loadIssue(issueRef: string, input?: string): Promise<IssueInput> {
  if (input) {
    const raw = input === "-" ? await readStdin() : await readFile(input, "utf8");
    return normalize(JSON.parse(stripBom(raw)));
  }
  const num = numericRef(issueRef);
  const { stdout } = await exec("gh", ["issue", "view", num, "--json", "number,title,body,comments"]);
  const data = normalize(JSON.parse(stdout));
  data.number ??= Number(num);
  return data;
}

/** Map gh's JSON shape (comments[].author.login) onto IssueInput. */
function normalize(raw: {
  number?: number;
  title?: string;
  body?: string;
  comments?: { author?: { login?: string }; body?: string }[];
}): IssueInput {
  return {
    number: raw.number,
    title: raw.title ?? "",
    body: raw.body ?? "",
    comments: (raw.comments ?? []).map((c) => ({ author: c.author?.login, body: c.body ?? "" })),
  };
}

