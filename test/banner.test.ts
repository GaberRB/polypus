import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { banner } from "../src/ui/banner.js";
import { VERSION } from "../src/core/version.js";

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

describe("banner version", () => {
  it("resolves the version from package.json", () => {
    expect(VERSION).toBe(pkg.version);
  });

  it("shows the package.json version, not a hardcoded one", () => {
    expect(banner()).toContain(`v${pkg.version}`);
  });
});
