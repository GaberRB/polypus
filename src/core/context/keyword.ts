import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

/**
 * Zero-setup context fallback. Semantic retrieval (RAG) needs an embeddings
 * backend and a built index; most Ollama/local users have neither. This walks
 * the workspace and pulls the lines that mention the task's keywords, so weak
 * models still start grounded in the real code instead of guessing. Only reads
 * files, never writes.
 */

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", "coverage", ".turbo",
  ".poly", ".polypus", "target", "venv", ".venv", "__pycache__",
]);
const MAX_FILE_BYTES = 500_000;
const NUL = String.fromCharCode(0);
const MAX_FILES_SCANNED = 4000;
const MAX_LINES_PER_FILE = 8;
const SNIPPET_CHARS = 200;

/** Words too generic to be useful as search keys (EN + PT-BR + coding filler). */
const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "your", "you",
  "are", "was", "but", "not", "use", "using", "add", "create", "make", "new",
  "file", "files", "code", "function", "method", "class", "should", "must",
  "please", "need", "want", "fix", "bug", "test", "tests", "run", "all", "any",
  "uma", "para", "com", "que", "dos", "das", "como", "isso", "esse", "essa",
  "criar", "fazer", "novo", "nova", "arquivo", "arquivos", "codigo", "função",
  "funcao", "metodo", "classe", "adicione", "adicionar", "corrija", "corrigir",
]);

/** Pull distinct, meaningful keyword tokens from the task text. */
export function extractKeywords(query: string, max = 12): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of query.split(/[^A-Za-z0-9_]+/)) {
    if (raw.length < 3) continue;
    const lc = raw.toLowerCase();
    if (STOPWORDS.has(lc) || seen.has(lc)) continue;
    seen.add(lc);
    out.push(raw);
    if (out.length >= max) break;
  }
  return out;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface FileHits {
  file: string;
  snippets: Array<{ line: number; text: string }>;
  /** How many distinct keywords this file matched (primary ranking signal). */
  coverage: number;
  total: number;
}

/**
 * Best-effort keyword context for `polypus run`. Returns a formatted block of
 * the most relevant lines for the task, or null when nothing matches. Never
 * throws — any IO error yields null so the run proceeds without context.
 */
export async function keywordContext(
  workspace: string,
  query: string,
  opts: { topK: number; maxChars: number },
): Promise<{ block: string; count: number } | null> {
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return null;
  const perKeyword = keywords.map((k) => new RegExp(escapeRe(k), "i"));

  const hits: FileHits[] = [];
  let scanned = 0;

  const walk = async (dir: string): Promise<void> => {
    if (scanned >= MAX_FILES_SCANNED) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (scanned >= MAX_FILES_SCANNED) return;
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) await walk(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      scanned++;
      try {
        const info = await stat(abs);
        if (info.size > MAX_FILE_BYTES) continue;
        const content = await readFile(abs, "utf8");
        if (content.includes(NUL)) continue; // binary
        const lines = content.split("\n");
        const snippets: Array<{ line: number; text: string }> = [];
        const covered = new Set<number>();
        let total = 0;
        for (let i = 0; i < lines.length; i++) {
          let any = false;
          for (let k = 0; k < perKeyword.length; k++) {
            if (perKeyword[k]!.test(lines[i]!)) {
              covered.add(k);
              any = true;
            }
          }
          if (any) {
            total++;
            if (snippets.length < MAX_LINES_PER_FILE) {
              snippets.push({ line: i + 1, text: lines[i]!.trim().slice(0, SNIPPET_CHARS) });
            }
          }
        }
        if (snippets.length > 0) {
          hits.push({ file: toPosixRel(workspace, abs), snippets, coverage: covered.size, total });
        }
      } catch {
        // unreadable / non-utf8 — skip
      }
    }
  };

  await walk(resolve(workspace));
  if (hits.length === 0) return null;

  // Rank by distinct-keyword coverage, then by raw hit count.
  hits.sort((a, b) => b.coverage - a.coverage || b.total - a.total);

  const blocks: string[] = [];
  let used = 0;
  for (const h of hits.slice(0, opts.topK)) {
    const body = h.snippets.map((s) => `${s.line}: ${s.text}`).join("\n");
    const block = `## ${h.file}\n\`\`\`\n${body}\n\`\`\``;
    if (used + block.length > opts.maxChars && blocks.length > 0) break;
    blocks.push(block);
    used += block.length + 2;
  }
  return blocks.length > 0 ? { block: blocks.join("\n\n"), count: blocks.length } : null;
}

function toPosixRel(workspace: string, abs: string): string {
  return abs.slice(workspace.length + 1).split("\\").join("/");
}
