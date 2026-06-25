import { describe, expect, it } from "vitest";
import { prerequisiteHint } from "../src/cli/commands/run.js";
import { t, setLocale } from "../src/core/i18n/index.js";

describe("prerequisiteHint", () => {
  it("maps the run_python_script 'Python not found' failure to a hint key", () => {
    const key = prerequisiteHint("Python not found (tried python3, python, py -3). Install Python 3 …");
    expect(key).toBe("run.hint.pythonMissing");
  });

  it("returns null for unrelated failures", () => {
    expect(prerequisiteHint("Command failed (exit 1): boom")).toBeNull();
  });

  it("the hint key is translated in both locales (not echoed back)", () => {
    setLocale("en");
    expect(t("run.hint.pythonMissing")).not.toBe("run.hint.pythonMissing");
    expect(t("run.hint.pythonMissing")).toMatch(/python\.org/i);
    setLocale("pt-BR");
    expect(t("run.hint.pythonMissing")).toMatch(/instale/i);
    setLocale("pt-BR");
  });
});
