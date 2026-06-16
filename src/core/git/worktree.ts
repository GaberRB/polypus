import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { simpleGit, type SimpleGit } from "simple-git";

export interface Worktree {
  path: string;
  branch: string;
}

export interface MergeResult {
  branch: string;
  ok: boolean;
  conflicts: string[];
}

/** Ensure the workspace is a git repo with at least one commit (worktrees need a base ref). */
export async function ensureRepo(workspace: string): Promise<SimpleGit> {
  const git = simpleGit(workspace);
  if (!(await git.checkIsRepo())) {
    await git.init();
  }
  const identity = await identityArgs(git);
  // A fresh repo has no HEAD; create an empty initial commit so we can branch.
  const hasHead = await git
    .raw(["rev-parse", "--verify", "HEAD"])
    .then(() => true)
    .catch(() => false);
  if (!hasHead) {
    await git.raw([...identity, "commit", "--allow-empty", "-m", "polypus: initial commit"]);
  }
  return git;
}

/**
 * Provide a fallback committer identity only when the repo/global config has
 * none, so we never override a user's configured name/email.
 */
async function identityArgs(git: SimpleGit): Promise<string[]> {
  const email = await git.raw(["config", "user.email"]).catch(() => "");
  if (email.trim()) return [];
  return ["-c", "user.email=polypus@local", "-c", "user.name=Polypus"];
}

/** Create an isolated worktree on a new branch off the current HEAD. */
export async function createWorktree(
  git: SimpleGit,
  label: string,
): Promise<Worktree> {
  const branch = `polypus/${label}-${Date.now().toString(36)}`;
  const path = await mkdtemp(join(tmpdir(), "polypus-wt-"));
  await git.raw(["worktree", "add", "-b", branch, path, "HEAD"]);
  return { path, branch };
}

/** Stage and commit everything a worker produced in its worktree. */
export async function commitWorktree(wt: Worktree, message: string): Promise<boolean> {
  const wtGit = simpleGit(wt.path);
  await wtGit.add(["-A"]);
  const status = await wtGit.status();
  if (status.staged.length === 0 && status.files.length === 0) return false;
  const identity = await identityArgs(wtGit);
  await wtGit.raw([...identity, "commit", "-m", message]);
  return true;
}

/** Merge a worker branch into the workspace's current branch, reporting conflicts. */
export async function mergeWorktreeBranch(
  git: SimpleGit,
  branch: string,
): Promise<MergeResult> {
  try {
    const identity = await identityArgs(git);
    await git.raw([...identity, "merge", "--no-edit", branch]);
    return { branch, ok: true, conflicts: [] };
  } catch (err) {
    // simple-git throws on conflict; collect conflicted files and abort cleanly.
    const status = await git.status().catch(() => undefined);
    const conflicts = status?.conflicted ?? [];
    await git.raw(["merge", "--abort"]).catch(() => undefined);
    if (conflicts.length === 0) {
      // Not a conflict — rethrow the original error.
      throw err;
    }
    return { branch, ok: false, conflicts };
  }
}

/** Remove a worktree and delete its branch. */
export async function removeWorktree(git: SimpleGit, wt: Worktree): Promise<void> {
  await git.raw(["worktree", "remove", wt.path, "--force"]).catch(() => undefined);
  await git.raw(["branch", "-D", wt.branch]).catch(() => undefined);
}
