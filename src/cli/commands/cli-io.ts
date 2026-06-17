import { t } from "../../core/i18n/index.js";

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
