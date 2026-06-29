/**
 * Minimal JSONPath evaluator — no external dependencies.
 * Supports: $.key, $.a.b.c, $.arr[0], $.arr[*], $.arr[*].key, $[0], $.*.key
 */

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export function query(obj: unknown, path: string): unknown {
  if (!path.startsWith("$")) throw new Error(`JSONPath must start with $: ${path}`);

  const segments = tokenise(path.slice(1));
  return evaluate(obj, segments);
}

function evaluate(node: unknown, segments: string[]): unknown {
  if (segments.length === 0) return node;
  const [head, ...rest] = segments as [string, ...string[]];

  // wildcard — collect all children
  if (head === "*") {
    const children = Array.isArray(node)
      ? node
      : node !== null && typeof node === "object"
        ? Object.values(node as Record<string, unknown>)
        : [];
    return rest.length === 0
      ? children
      : children.flatMap((c) => {
          const r = evaluate(c, rest);
          return Array.isArray(r) ? r : [r];
        });
  }

  // numeric index
  if (/^\d+$/.test(head)) {
    if (!Array.isArray(node)) return undefined;
    return evaluate((node as unknown[])[Number(head)], rest);
  }

  // object key
  if (node === null || typeof node !== "object" || Array.isArray(node)) return undefined;
  return evaluate((node as Record<string, unknown>)[head], rest);
}

/** Split a JSONPath tail (after $) into navigation segments. */
function tokenise(tail: string): string[] {
  const segments: string[] = [];
  let i = 0;
  while (i < tail.length) {
    if (tail[i] === ".") {
      i++;
      if (tail[i] === "*") {
        segments.push("*");
        i++;
      } else {
        let key = "";
        while (i < tail.length && tail[i] !== "." && tail[i] !== "[") key += tail[i++];
        if (key) segments.push(key);
      }
    } else if (tail[i] === "[") {
      i++;
      let inner = "";
      while (i < tail.length && tail[i] !== "]") inner += tail[i++];
      i++; // skip ]
      if (inner === "*") segments.push("*");
      else segments.push(inner.replace(/^['"]|['"]$/g, ""));
    } else {
      // bare key at start (e.g. path = "foo.bar" without leading dot)
      let key = "";
      while (i < tail.length && tail[i] !== "." && tail[i] !== "[") key += tail[i++];
      if (key) segments.push(key);
    }
  }
  return segments;
}
