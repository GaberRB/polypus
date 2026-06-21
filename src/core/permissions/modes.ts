import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { PermissionMode } from "../config/schema.js";
import { checkPath, isCommandPreApproved, type PathPolicy } from "./allowlist.js";
import { scanSecrets, screenCommand } from "./policy.js";
import { computeHunks, type Hunk } from "./diff.js";
import { applyHunks } from "./diff.js";
import { t } from "../i18n/index.js";

export interface ConfirmRequest {
  kind: "write" | "command";
  summary: string;
  preview?: string;
  /** For writes in review mode: the change split into hunks, for diff/hunk approval. */
  hunks?: Hunk[];
}

/**
 * Result of a confirmation: `true` = approve all, `false` = reject, or an array
 * of approved hunk indexes (a subset approval for a write).
 */
export type ConfirmResult = boolean | number[];

export type ConfirmFn = (req: ConfirmRequest) => Promise<ConfirmResult>;

export interface Decision {
  allowed: boolean;
  reason?: string;
  /** When present, the exact content the caller should write (a subset-of-hunks result). */
  content?: string;
}

export interface PermissionEngineOptions {
  mode: PermissionMode;
  policy: PathPolicy;
  allowedCommands: string[];
  /** Invoked in `review` mode to ask the user. Defaults to deny if absent. */
  confirm?: ConfirmFn;
}

/** Central authority for whether a file write or command may proceed. */
export class PermissionEngine {
  constructor(private readonly opts: PermissionEngineOptions) {}

  get mode(): PermissionMode {
    return this.opts.mode;
  }

  /** Reads are allowed in every mode as long as the path is within the allow-list. */
  authorizeRead(target: string): Decision {
    const d = checkPath(this.opts.policy, target);
    return d.allowed ? { allowed: true } : { allowed: false, reason: d.reason };
  }

  async authorizeWrite(target: string, preview?: string, content?: string): Promise<Decision> {
    const d = checkPath(this.opts.policy, target);
    if (!d.allowed) return { allowed: false, reason: d.reason };

    // Read the current file (if any) so we can diff and scan only added lines.
    let oldContent = "";
    try {
      oldContent = await readFile(resolve(this.opts.policy.workspace, target), "utf8");
    } catch {
      /* new file — no old content */
    }
    const hunks = content !== undefined ? computeHunks(oldContent, content) : [];
    const added = hunks
      .flatMap((h) => h.lines.filter((l) => l.type === "+").map((l) => l.text))
      .join("\n");

    // Block hard-coded secrets in the added content before any mode gating —
    // applies even in bypass. Pre-existing secrets are not re-flagged.
    const findings = scanSecrets(hunks.length > 0 ? added : content ?? preview ?? "");
    if (findings.length > 0) {
      const first = findings[0]!;
      return {
        allowed: false,
        reason: t("policy.secretFound", { kind: first.kind, line: first.line }),
      };
    }

    if (this.opts.mode === "plan") {
      return { allowed: false, reason: "plan mode: file modifications are disabled" };
    }
    if (this.opts.mode === "bypass") return { allowed: true };

    const res = await this.ask({ kind: "write", summary: `write ${d.rel}`, preview, hunks });
    if (res === true) return { allowed: true };
    if (res === false) return { allowed: false, reason: "rejected by user" };

    // A subset of hunk indexes was approved.
    const approved = new Set(res);
    if (approved.size === 0) return { allowed: false, reason: "rejected by user" };
    if (approved.size === hunks.length) return { allowed: true };
    return { allowed: true, content: applyHunks(oldContent, hunks, approved) };
  }

  async authorizeCommand(command: string): Promise<Decision> {
    // Destructive commands are blocked in every mode, including bypass.
    const screen = screenCommand(command);
    if (screen.blocked) {
      return { allowed: false, reason: t("policy.blockedCommand", { reason: screen.reason ?? "" }) };
    }
    if (this.opts.mode === "plan") {
      return { allowed: false, reason: "plan mode: running commands is disabled" };
    }
    if (this.opts.mode === "bypass") return { allowed: true };
    if (isCommandPreApproved(this.opts.allowedCommands, command)) return { allowed: true };

    const res = await this.ask({ kind: "command", summary: `run: ${command}` });
    return res === true ? { allowed: true } : { allowed: false, reason: "rejected by user" };
  }

  private async ask(req: ConfirmRequest): Promise<ConfirmResult> {
    if (!this.opts.confirm) return false;
    return this.opts.confirm(req);
  }
}
