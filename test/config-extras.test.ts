import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setEnvVar } from "../src/core/config/dotenv.js";
import { upsertAgent } from "../src/core/config/store.js";
import { PolypusConfig } from "../src/core/config/schema.js";

let home: string;
let saved: string | undefined;
beforeEach(() => {
  saved = process.env.POLYPUS_HOME;
  home = mkdtempSync(join(tmpdir(), "polypus-cfg-"));
  process.env.POLYPUS_HOME = home;
});
afterEach(() => {
  if (saved === undefined) delete process.env.POLYPUS_HOME;
  else process.env.POLYPUS_HOME = saved;
  try {
    rmSync(home, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe("setEnvVar", () => {
  const read = () => readFileSync(join(home, ".env"), "utf8");

  it("creates the file and writes KEY=value", async () => {
    await setEnvVar("OPENROUTER_API_KEY", "sk-abc");
    expect(read()).toContain("OPENROUTER_API_KEY=sk-abc");
  });

  it("upserts in place (no duplicate) and preserves other lines", async () => {
    await setEnvVar("A", "1");
    await setEnvVar("B", "2");
    await setEnvVar("A", "9"); // replace A
    const txt = read();
    expect(txt).toContain("A=9");
    expect(txt).toContain("B=2");
    expect(txt.match(/^A=/gm)).toHaveLength(1);
  });

  it("quotes values with whitespace", async () => {
    await setEnvVar("K", "two words");
    expect(read()).toContain('K="two words"');
  });
});

describe("upsertAgent", () => {
  it("adds an agent and makes the first one the default", () => {
    const cfg = PolypusConfig.parse({});
    upsertAgent(cfg, { name: "a", provider: "ollama", model: "llama3" });
    expect(cfg.agents).toHaveLength(1);
    expect(cfg.defaultAgent).toBe("a");
  });

  it("replaces an agent by name instead of duplicating", () => {
    const cfg = PolypusConfig.parse({});
    upsertAgent(cfg, { name: "a", provider: "ollama", model: "llama3" });
    upsertAgent(cfg, { name: "a", provider: "ollama", model: "llama3.1" });
    expect(cfg.agents).toHaveLength(1);
    expect(cfg.agents[0]!.model).toBe("llama3.1");
  });

  it("setDefault switches the default agent", () => {
    const cfg = PolypusConfig.parse({});
    upsertAgent(cfg, { name: "a", provider: "ollama", model: "x" });
    upsertAgent(cfg, { name: "b", provider: "ollama", model: "y", setDefault: true });
    expect(cfg.defaultAgent).toBe("b");
  });
});
