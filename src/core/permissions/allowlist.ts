import { isAbsolute, relative, resolve, sep } from "node:path";

/**
 * Convert a glob to a RegExp. Supports `**` (any path segments, including none),
 * `*` (within a segment), and `?` (single non-slash char). Paths are matched in
 * POSIX form (forward slashes).
 */
export function globToRegExp(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === "*") {
      if (glob[i + 1] === "*") {
        // `**` — any sequence including slashes; swallow an optional following slash.
        re += ".*";
        i++;
        if (glob[i + 1] === "/") i++;
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if (".+^${}()|[]\\".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`);
}

/** Normalize an OS path to a POSIX-style relative path for glob matching. */
export function toPosix(p: string): string {
  return p.split(sep).join("/");
}

export interface PathPolicy {
  workspace: string;
  allow: string[];
  deny: string[];
}

export interface PathDecision {
  allowed: boolean;
  reason?: string;
  /** Workspace-relative POSIX path. */
  rel: string;
}

/**
 * Decide whether a path may be accessed. Rejects paths outside the workspace,
 * then applies deny globs (which win) and allow globs.
 */
export function checkPath(policy: PathPolicy, target: string): PathDecision {
  const abs = isAbsolute(target) ? target : resolve(policy.workspace, target);
  const rel = toPosix(relative(policy.workspace, abs));

  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
    return { allowed: false, rel, reason: "path escapes the workspace" };
  }
  for (const d of policy.deny) {
    if (globToRegExp(d).test(rel)) {
      return { allowed: false, rel, reason: `denied by deny-list pattern "${d}"` };
    }
  }
  for (const a of policy.allow) {
    if (globToRegExp(a).test(rel)) return { allowed: true, rel };
  }
  return { allowed: false, rel, reason: "not in the allow-list" };
}

/** A command is pre-approved when it starts with one of the allowed prefixes. */
export function isCommandPreApproved(allowedCommands: string[], command: string): boolean {
  const c = command.trim();
  return allowedCommands.some((prefix) => c === prefix || c.startsWith(prefix.trim() + " "));
}
