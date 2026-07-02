import { execFileSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { readdirSync } from "node:fs";
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
  const rand = crypto.randomUUID().slice(0, 8);
  const branch = `polypus/${label}-${Date.now().toString(36)}-${rand}`;
  const path = await mkdtemp(join(tmpdir(), "polypus-wt-"));
  await git.raw(["worktree", "add", "-b", branch, path, "HEAD"]);
  return { path, branch };
}

/** Stage and commit everything a worker produced in its worktree. */
export async function commitWorktree(wt: Worktree, message: string): Promise<boolean> {
  const wtGit = simpleGit(wt.path);
  const identity = await identityArgs(wtGit);
  // Debug: list files in worktree before attempting git operations
  const { readdirSync, existsSync } = await import("node:fs");
  let filesBefore: string[] = [];
  try { filesBefore = readdirSync(wt.path, { withFileTypes: true }).map(d => d.name).filter(n => n !== ".git"); } catch {}
  // Use execFileSync directly instead of simple-git.raw() for git operations
  // in worktrees on Windows, where simple-git can behave unreliably.
  try {
    console.error(`[commitWorktree] path=${wt.path} branch=${wt.branch} files=[${filesBefore.join(",")}] identity=[${identity.join(" ")}]`);
    const addArgs = ["-C", wt.path, ...identity, "add", "-A"];
    execFileSync("git", addArgs, { stdio: "pipe", shell: false });
    const statusOut = execFileSync("git", ["-C", wt.path, "status", "--porcelain"], { stdio: "pipe", shell: false, encoding: "utf-8" });
    console.error(`[commitWorktree] after-add status:\n${statusOut}`);
    const commitArgs = ["-C", wt.path, ...identity, "commit", "-m", message];
    execFileSync("git", commitArgs, { stdio: "pipe", shell: false });
    return true;
  } catch (e: any) {
    const stderr = e?.stderr?.toString()?.trim() || "";
    const stdout = e?.stdout?.toString()?.trim() || "";
    console.error(`[commitWorktree] FAILED | stderr=${stderr} | stdout=${stdout} | msg=${e?.message}`);
    return false;
  }
}

/** Merge a worker branch into the workspace's current branch, reporting conflicts. */
export async function mergeWorktreeBranch(
  git: SimpleGit,
  branch: string,
): Promise<MergeResult> {
  const identity = await identityArgs(git);
  // Run the merge. It may reject on conflict (simple-git) OR — observed on
  // Windows — leave conflicts in the index without rejecting. Either way, we
  // decide what happened by inspecting the status below, never by trusting the
  // absence of a throw.
  let mergeError: unknown;
  try {
    await git.raw([...identity, "merge", "--no-ff", "--no-edit", branch]);
  } catch (err) {
    mergeError = err;
  }

  const status = await git.status().catch(() => undefined);
  const conflicts = status?.conflicted ?? [];
  if (conflicts.length > 0) {
    // Real conflict: abort so the branch is kept for inspection and reported.
    // (Previously a `checkout -f HEAD` ran here and silently discarded the
    // conflicted merge — losing the worker's work while reporting success.)
    await git.raw(["merge", "--abort"]).catch(() => undefined);
    return { branch, ok: false, conflicts };
  }
  if (mergeError) throw mergeError; // merge failed for a non-conflict reason

  // Clean merge only: HEAD now holds the merge commit with both sides' changes.
  // On Windows the working tree can be left stale, so refresh it to match HEAD.
  // Safe here because we've confirmed there is no unresolved merge to discard.
  await git.raw(["checkout", "-f", "HEAD"]).catch(() => undefined);
  return { branch, ok: true, conflicts: [] };
}

/** Remove a worktree and delete its branch. */
export async function removeWorktree(git: SimpleGit, wt: Worktree): Promise<void> {
  await git.raw(["worktree", "remove", wt.path, "--force"]).catch(() => undefined);
  await git.raw(["branch", "-D", wt.branch]).catch(() => undefined);
}
