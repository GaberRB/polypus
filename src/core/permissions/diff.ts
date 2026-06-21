/**
 * Minimal line-based diff (LCS) grouped into hunks, used to show the real change
 * in `review` mode and to let the user approve a subset of hunks. Dependency-free.
 */

export type DiffLineType = " " | "-" | "+";

export interface DiffLine {
  type: DiffLineType;
  text: string;
}

export interface Hunk {
  /** 0-based index of the first old-file line this hunk covers. */
  oldStart: number;
  /** Number of old-file lines this hunk covers (context + removed). */
  oldCount: number;
  /** 0-based index of the first new-file line this hunk covers. */
  newStart: number;
  /** Number of new-file lines this hunk produces (context + added). */
  newCount: number;
  lines: DiffLine[];
}

const CONTEXT = 3;

function splitLines(text: string): string[] {
  return text === "" ? [] : text.split("\n");
}

/** Longest-common-subsequence table over two line arrays. */
function lcsOps(a: string[], b: string[]): DiffLine[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: " ", text: a[i]! });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      out.push({ type: "-", text: a[i]! });
      i++;
    } else {
      out.push({ type: "+", text: b[j]! });
      j++;
    }
  }
  while (i < n) out.push({ type: "-", text: a[i++]! });
  while (j < m) out.push({ type: "+", text: b[j++]! });
  return out;
}

/** Compute the hunks (changed regions with surrounding context) between two texts. */
export function computeHunks(oldText: string, newText: string): Hunk[] {
  const a = splitLines(oldText);
  const b = splitLines(newText);
  const ops = lcsOps(a, b);

  // Mark which positions in the op list are changes; expand by CONTEXT.
  const isChange = ops.map((o) => o.type !== " ");
  const keep = new Array<boolean>(ops.length).fill(false);
  for (let k = 0; k < ops.length; k++) {
    if (isChange[k]) {
      for (let c = Math.max(0, k - CONTEXT); c <= Math.min(ops.length - 1, k + CONTEXT); c++) {
        keep[c] = true;
      }
    }
  }

  const hunks: Hunk[] = [];
  let oldLine = 0;
  let newLine = 0;
  let k = 0;
  while (k < ops.length) {
    const op = ops[k]!;
    if (!keep[k]) {
      if (op.type !== "+") oldLine++;
      if (op.type !== "-") newLine++;
      k++;
      continue;
    }
    // Start a hunk; consume the contiguous kept run.
    const oldStart = oldLine;
    const newStart = newLine;
    const lines: DiffLine[] = [];
    let oldCount = 0;
    let newCount = 0;
    while (k < ops.length && keep[k]) {
      const cur = ops[k]!;
      lines.push(cur);
      if (cur.type !== "+") {
        oldLine++;
        oldCount++;
      }
      if (cur.type !== "-") {
        newLine++;
        newCount++;
      }
      k++;
    }
    hunks.push({ oldStart, oldCount, newStart, newCount, lines });
  }
  return hunks;
}

/**
 * Reconstruct a file from its old text, applying only the approved hunks.
 * Unapproved hunks keep the original lines. `approved` is a set of hunk indexes.
 */
export function applyHunks(oldText: string, hunks: Hunk[], approved: Set<number>): string {
  const a = splitLines(oldText);
  const out: string[] = [];
  let oldIdx = 0;
  hunks.forEach((hunk, idx) => {
    while (oldIdx < hunk.oldStart) out.push(a[oldIdx++]!);
    if (approved.has(idx)) {
      for (const l of hunk.lines) if (l.type !== "-") out.push(l.text);
    } else {
      for (const l of hunk.lines) if (l.type !== "+") out.push(l.text);
    }
    oldIdx = hunk.oldStart + hunk.oldCount;
  });
  while (oldIdx < a.length) out.push(a[oldIdx++]!);
  return out.join("\n");
}

/** A short one-line label for a hunk, used in the selection prompt. */
export function hunkLabel(hunk: Hunk): string {
  const added = hunk.lines.filter((l) => l.type === "+").length;
  const removed = hunk.lines.filter((l) => l.type === "-").length;
  const firstChange = hunk.lines.find((l) => l.type !== " ");
  const preview = firstChange ? firstChange.text.trim().slice(0, 50) : "";
  return `@@ -${hunk.oldStart + 1},${hunk.oldCount} +${hunk.newStart + 1},${hunk.newCount} @@ (+${added}/-${removed}) ${preview}`;
}
