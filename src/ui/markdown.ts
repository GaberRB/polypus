import pc from "picocolors";

/**
 * Render a subset of Markdown for the terminal: headings, bullet/numbered lists,
 * fenced and inline code, bold and italic. Colors go through picocolors, so they
 * auto-disable under NO_COLOR / non-TTY. Structural transforms (stripped markers,
 * `•` bullets) happen regardless of color, so the output is always cleaner than
 * the raw markdown.
 */
export function renderMarkdown(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inFence = false;
  for (const raw of lines) {
    if (/^\s*```/.test(raw)) {
      inFence = !inFence; // swallow the fence marker line itself
      continue;
    }
    if (inFence) {
      out.push(pc.dim("  │ " + raw));
      continue;
    }
    out.push(renderLine(raw));
  }
  return out.join("\n");
}

function renderLine(line: string): string {
  const heading = /^(#{1,6})\s+(.*)$/.exec(line);
  if (heading) return pc.bold(pc.underline(inline(heading[2]!)));

  const bullet = /^(\s*)[-*+]\s+(.*)$/.exec(line);
  if (bullet) return `${bullet[1]}${pc.cyan("•")} ${inline(bullet[2]!)}`;

  const numbered = /^(\s*)(\d+)\.\s+(.*)$/.exec(line);
  if (numbered) return `${numbered[1]}${pc.cyan(`${numbered[2]}.`)} ${inline(numbered[3]!)}`;

  return inline(line);
}

/** Apply inline styling, stripping the markers. Code spans first so their
 * contents aren't re-processed as bold/italic. */
function inline(s: string): string {
  s = s.replace(/`([^`]+)`/g, (_m, c: string) => pc.yellow(c));
  s = s.replace(/\*\*([^*]+)\*\*/g, (_m, c: string) => pc.bold(c));
  s = s.replace(/__([^_]+)__/g, (_m, c: string) => pc.bold(c));
  s = s.replace(/(?<![*\w])\*([^*\n]+)\*(?![*\w])/g, (_m, c: string) => pc.italic(c));
  s = s.replace(/(?<![_\w])_([^_\n]+)_(?![_\w])/g, (_m, c: string) => pc.italic(c));
  return s;
}
