import { describe, expect, it } from "vitest";
import { isPrivateAddress, screenUrl } from "../src/core/permissions/policy.js";
import { PermissionEngine } from "../src/core/permissions/modes.js";

describe("isPrivateAddress", () => {
  it("flags private, loopback, link-local and cloud-metadata IPs", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.5.5", "192.168.0.1", "169.254.169.254", "0.0.0.0", "100.64.0.1"]) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
    expect(isPrivateAddress("::1")).toBe(true);
    expect(isPrivateAddress("fc00::1")).toBe(true);
    expect(isPrivateAddress("fe80::1")).toBe(true);
    expect(isPrivateAddress("::ffff:127.0.0.1")).toBe(true);
  });

  it("treats public addresses as public", () => {
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
    expect(isPrivateAddress("1.1.1.1")).toBe(false);
    expect(isPrivateAddress("2606:4700:4700::1111")).toBe(false);
  });
});

describe("screenUrl", () => {
  it("blocks non-https schemes", () => {
    expect(screenUrl("http://example.com").blocked).toBe(true);
    expect(screenUrl("file:///etc/passwd").blocked).toBe(true);
    expect(screenUrl("ftp://example.com").blocked).toBe(true);
  });

  it("blocks localhost, internal hostnames and private IP literals", () => {
    expect(screenUrl("https://localhost/").blocked).toBe(true);
    expect(screenUrl("https://db.internal/").blocked).toBe(true);
    expect(screenUrl("https://printer.local/").blocked).toBe(true);
    expect(screenUrl("https://169.254.169.254/latest/meta-data/").blocked).toBe(true);
    expect(screenUrl("https://10.0.0.5/").blocked).toBe(true);
  });

  it("blocks embedded credentials and disallowed ports", () => {
    expect(screenUrl("https://user:pass@example.com/").blocked).toBe(true);
    expect(screenUrl("https://example.com:8080/").blocked).toBe(true);
  });

  it("allows ordinary public https URLs", () => {
    expect(screenUrl("https://example.com/path?q=1").blocked).toBe(false);
    expect(screenUrl("https://html.duckduckgo.com/html/?q=test").blocked).toBe(false);
  });

  it("honours allow/deny domain lists", () => {
    expect(screenUrl("https://evil.com/", { denyDomains: ["evil.com"] }).blocked).toBe(true);
    expect(screenUrl("https://api.evil.com/", { denyDomains: ["evil.com"] }).blocked).toBe(true);
    expect(screenUrl("https://other.com/", { allowDomains: ["example.com"] }).blocked).toBe(true);
    expect(screenUrl("https://docs.example.com/", { allowDomains: ["example.com"] }).blocked).toBe(false);
  });
});

describe("PermissionEngine.authorizeNetwork", () => {
  const policy = { workspace: "/ws", allow: ["**/*"], deny: [] };

  it("blocks SSRF/private targets even in bypass", async () => {
    const engine = new PermissionEngine({ mode: "bypass", policy, allowedCommands: [] });
    expect((await engine.authorizeNetwork("http://example.com")).allowed).toBe(false);
    expect((await engine.authorizeNetwork("https://169.254.169.254/")).allowed).toBe(false);
    expect((await engine.authorizeNetwork("https://localhost/")).allowed).toBe(false);
  });

  it("allows a clean public https URL in bypass", async () => {
    const engine = new PermissionEngine({ mode: "bypass", policy, allowedCommands: [] });
    expect((await engine.authorizeNetwork("https://example.com/")).allowed).toBe(true);
  });

  it("denies all network in plan mode", async () => {
    const engine = new PermissionEngine({ mode: "plan", policy, allowedCommands: [] });
    expect((await engine.authorizeNetwork("https://example.com/")).allowed).toBe(false);
  });

  it("asks the user in review mode and respects the answer", async () => {
    const yes = new PermissionEngine({ mode: "review", policy, allowedCommands: [], confirm: async () => true });
    const no = new PermissionEngine({ mode: "review", policy, allowedCommands: [], confirm: async () => false });
    expect((await yes.authorizeNetwork("https://example.com/")).allowed).toBe(true);
    expect((await no.authorizeNetwork("https://example.com/")).allowed).toBe(false);
  });

  it("applies the configured deny-list", async () => {
    const engine = new PermissionEngine({
      mode: "bypass",
      policy,
      allowedCommands: [],
      network: { denyDomains: ["tracker.com"] },
    });
    expect((await engine.authorizeNetwork("https://tracker.com/x")).allowed).toBe(false);
  });
});
