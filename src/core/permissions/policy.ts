/**
 * Safety policy shared by the permission engine: a deny-list of obviously
 * destructive shell commands, and a scanner for hard-coded secrets in file
 * writes. Both are deliberately conservative (specific patterns) to keep false
 * positives low while catching the dangerous/leaky cases.
 */

export interface CommandScreen {
  blocked: boolean;
  reason?: string;
}

/** Patterns that are almost never legitimate from an autonomous agent. */
const DANGEROUS_COMMANDS: { re: RegExp; reason: string }[] = [
  { re: /--no-preserve-root/i, reason: "rm --no-preserve-root" },
  { re: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, reason: "fork bomb" },
  { re: /\bmkfs(\.\w+)?\b/i, reason: "filesystem format (mkfs)" },
  { re: /\bdd\b[^\n]*\bof=\/dev\/(sd|nvme|hd|disk)/i, reason: "dd writing to a raw disk device" },
  { re: />\s*\/dev\/(sd|nvme|hd|disk)/i, reason: "redirect to a raw disk device" },
  { re: /\bchmod\s+(-[a-z]*\s+)*-?R?\s*777\s+\//i, reason: "chmod 777 on /" },
  { re: /\b(curl|wget)\b[^\n|]*\|\s*(sudo\s+)?(sh|bash|zsh)\b/i, reason: "piping a downloaded script straight into a shell" },
];

/** A recursive+force `rm` aimed at root, home, or a bare glob — catastrophic. */
function isDangerousRm(command: string): boolean {
  if (!/\brm\b/i.test(command)) return false;
  const recursive =
    /(?:^|\s)-[a-z]*r[a-z]*f/i.test(command) ||
    /(?:^|\s)-[a-z]*f[a-z]*r/i.test(command) ||
    (/(?:^|\s)-[a-z]*r\b/i.test(command) && /(?:^|\s)-[a-z]*f\b/i.test(command));
  if (!recursive) return false;
  // Target is bare root, /*, ~, $HOME, or a lone * (whole working dir).
  return /(?:\s|^)(?:\/\*|\/|~|\$HOME|\*)(?:\s|$)/.test(command);
}

/** Decide whether a shell command is too dangerous to run in any mode. */
export function screenCommand(command: string): CommandScreen {
  if (isDangerousRm(command)) {
    return { blocked: true, reason: "recursive force-delete of / ~ or *" };
  }
  for (const { re, reason } of DANGEROUS_COMMANDS) {
    if (re.test(command)) return { blocked: true, reason };
  }
  return { blocked: false };
}

export interface SecretFinding {
  line: number;
  kind: string;
}

const SECRET_PATTERNS: { re: RegExp; kind: string }[] = [
  { re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/, kind: "private key block" },
  { re: /\bAKIA[0-9A-Z]{16}\b/, kind: "AWS access key id" },
  { re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/, kind: "GitHub token" },
  { re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, kind: "Slack token" },
  { re: /\bsk-[A-Za-z0-9]{32,}\b/, kind: "OpenAI-style secret key" },
  { re: /\bAIza[0-9A-Za-z_-]{35}\b/, kind: "Google API key" },
];

/** Scan text for hard-coded secrets. Returns one finding per matching line. */
export function scanSecrets(text: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    for (const { re, kind } of SECRET_PATTERNS) {
      if (re.test(lines[i]!)) {
        findings.push({ line: i + 1, kind });
        break; // one finding per line is enough to block
      }
    }
  }
  return findings;
}
