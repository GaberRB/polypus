import { chmod, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { globToRegExp, toPosix } from "./allowlist.js";

/** True when a workspace-relative POSIX path matches any of the protect globs. */
export function isProtected(globs: string[], relPosix: string): boolean {
  return globs.some((g) => globToRegExp(g).test(relPosix));
}

/** Walk the workspace collecting files that match any protect glob. */
async function matchedFiles(workspace: string, globs: string[]): Promise<string[]> {
  if (globs.length === 0) return [];
  const out: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === ".git" || e.name === "node_modules") continue;
      const abs = join(dir, e.name);
      if (e.isDirectory()) {
        await walk(abs);
      } else if (e.isFile()) {
        if (isProtected(globs, toPosix(relative(workspace, abs)))) out.push(abs);
      }
    }
  };
  await walk(workspace);
  return out;
}

/**
 * Make files matching `globs` read-only at the OS level for the duration of an
 * agent run, returning a restore function that puts back the original modes.
 *
 * This is the real protection boundary. Unlike a tool-level deny (which only
 * covers write_file/edit_file) or a hook screening command text (defeatable via
 * shell globs/variables), an OS read-only bit makes the *filesystem* refuse the
 * write — so `sed -i`, `echo > file`, python `open('w')`, and any other tool
 * all fail. Not a sandbox: an agent could still `chmod +w`/`attrib -r` first,
 * so those un-protect commands are screened as destructive elsewhere.
 */
export async function protectPaths(
  workspace: string,
  globs: string[],
): Promise<{ files: string[]; restore: () => Promise<void> }> {
  const files = await matchedFiles(workspace, globs);
  const original: Array<{ path: string; mode: number }> = [];
  for (const f of files) {
    try {
      const s = await stat(f);
      original.push({ path: f, mode: s.mode });
      await chmod(f, 0o444); // read-only; on Windows sets the read-only attribute
    } catch {
      /* best-effort: skip files we can't stat/chmod */
    }
  }
  return {
    files: original.map((o) => o.path),
    restore: async () => {
      for (const o of original) await chmod(o.path, o.mode).catch(() => {});
    },
  };
}
