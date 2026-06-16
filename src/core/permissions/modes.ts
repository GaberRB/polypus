import type { PermissionMode } from "../config/schema.js";
import { checkPath, isCommandPreApproved, type PathPolicy } from "./allowlist.js";

export interface ConfirmRequest {
  kind: "write" | "command";
  summary: string;
  preview?: string;
}

export type ConfirmFn = (req: ConfirmRequest) => Promise<boolean>;

export interface Decision {
  allowed: boolean;
  reason?: string;
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

  async authorizeWrite(target: string, preview?: string): Promise<Decision> {
    const d = checkPath(this.opts.policy, target);
    if (!d.allowed) return { allowed: false, reason: d.reason };

    if (this.opts.mode === "plan") {
      return { allowed: false, reason: "plan mode: file modifications are disabled" };
    }
    if (this.opts.mode === "bypass") return { allowed: true };

    const ok = await this.ask({ kind: "write", summary: `write ${d.rel}`, preview });
    return ok ? { allowed: true } : { allowed: false, reason: "rejected by user" };
  }

  async authorizeCommand(command: string): Promise<Decision> {
    if (this.opts.mode === "plan") {
      return { allowed: false, reason: "plan mode: running commands is disabled" };
    }
    if (this.opts.mode === "bypass") return { allowed: true };
    if (isCommandPreApproved(this.opts.allowedCommands, command)) return { allowed: true };

    const ok = await this.ask({ kind: "command", summary: `run: ${command}` });
    return ok ? { allowed: true } : { allowed: false, reason: "rejected by user" };
  }

  private async ask(req: ConfirmRequest): Promise<boolean> {
    if (!this.opts.confirm) return false;
    return this.opts.confirm(req);
  }
}
