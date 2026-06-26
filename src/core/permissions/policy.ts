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

import { isIP } from "node:net";

export interface UrlScreen {
  blocked: boolean;
  reason?: string;
}

export interface UrlPolicy {
  /** If non-empty, ONLY these domains (and subdomains) are reachable. */
  allowDomains?: string[];
  /** Domains (and subdomains) that are always blocked, even if on the allow-list. */
  denyDomains?: string[];
  /** Ports the agent may connect to. Defaults to https (443) only. */
  allowedPorts?: number[];
}

/**
 * Decide whether an IPv4/IPv6 literal points at a private, loopback, link-local,
 * or otherwise non-public address — the core of SSRF defense. Catches the cloud
 * metadata endpoint (169.254.169.254) and all RFC1918 ranges. IPv4-mapped IPv6
 * (`::ffff:a.b.c.d`) is unwrapped and re-checked.
 */
export function isPrivateAddress(ip: string): boolean {
  const fam = isIP(ip);
  if (fam === 4) return isPrivateV4(ip);
  if (fam === 6) return isPrivateV6(ip.toLowerCase());
  return false; // not an IP literal — caller handles hostnames separately
}

function isPrivateV4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts as [number, number, number, number];
  if (a === 0) return true; // 0.0.0.0/8 "this host"
  if (a === 10) return true; // 10/8 private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12 private
  if (a === 192 && b === 168) return true; // 192.168/16 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
  if (a === 192 && b === 0) return true; // 192.0.0/24 + 192.0.2/24 (test-net)
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18/15 benchmark
  if (a >= 224) return true; // 224/4 multicast + 240/4 reserved + 255.255.255.255
  return false;
}

function isPrivateV6(ip: string): boolean {
  if (ip === "::1" || ip === "::") return true; // loopback / unspecified
  // IPv4-mapped (::ffff:a.b.c.d) — unwrap and re-check as IPv4.
  const mapped = ip.match(/::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isPrivateV4(mapped[1]!);
  if (ip.startsWith("fe80") || ip.startsWith("fc") || ip.startsWith("fd")) return true; // link-local / ULA
  if (ip.startsWith("ff")) return true; // multicast
  return false;
}

/**
 * Screen an outbound URL before any network request. Enforced in every mode
 * (including bypass), mirroring how destructive commands and secrets are blocked.
 * Rejects non-https schemes, embedded credentials, non-allowed ports, localhost /
 * `*.local` / `*.internal` hostnames, private IP literals, and deny-listed
 * domains. Does NOT resolve DNS — connection-time SSRF (a public hostname that
 * resolves to a private IP) is closed by the custom `lookup` in safe-fetch.
 */
export function screenUrl(url: string, policy: UrlPolicy = {}): UrlScreen {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { blocked: true, reason: "malformed URL" };
  }
  if (u.protocol !== "https:") {
    return { blocked: true, reason: `scheme "${u.protocol.replace(":", "")}" is not allowed (https only)` };
  }
  if (u.username || u.password) {
    return { blocked: true, reason: "URLs with embedded credentials are not allowed" };
  }
  const allowedPorts = policy.allowedPorts ?? [443];
  const port = u.port ? Number(u.port) : 443;
  if (!allowedPorts.includes(port)) {
    return { blocked: true, reason: `port ${port} is not allowed` };
  }
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, ""); // strip IPv6 brackets
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return { blocked: true, reason: `host "${host}" resolves to a private/internal network` };
  }
  if (isIP(host) && isPrivateAddress(host)) {
    return { blocked: true, reason: `address "${host}" is private/loopback (SSRF blocked)` };
  }
  const matches = (d: string) => host === d.toLowerCase() || host.endsWith("." + d.toLowerCase());
  if (policy.denyDomains?.some(matches)) {
    return { blocked: true, reason: `host "${host}" is on the deny-list` };
  }
  if (policy.allowDomains && policy.allowDomains.length > 0 && !policy.allowDomains.some(matches)) {
    return { blocked: true, reason: `host "${host}" is not on the allow-list` };
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

/** Replace any secrets in the text with a redaction marker (best-effort). */
export function redactSecrets(text: string): string {
  let out = text;
  for (const { re } of SECRET_PATTERNS) {
    out = out.replace(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"), "[redacted]");
  }
  return out;
}

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
