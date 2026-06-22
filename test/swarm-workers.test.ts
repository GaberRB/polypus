import { describe, expect, it } from "vitest";
import { looksLikeLongRunningServer, runCommandTool } from "../src/core/tools/run-command.js";
import { PermissionEngine } from "../src/core/permissions/modes.js";

describe("looksLikeLongRunningServer", () => {
  it("flags dev servers / watchers / detached starts", () => {
    expect(looksLikeLongRunningServer("cd backend && start /B node dist/index.js")).toBe(true);
    expect(looksLikeLongRunningServer("npm run dev")).toBe(true);
    expect(looksLikeLongRunningServer("npm start")).toBe(true);
    expect(looksLikeLongRunningServer("yarn dev")).toBe(true);
    expect(looksLikeLongRunningServer("npx vite")).toBe(true);
    expect(looksLikeLongRunningServer("next dev")).toBe(true);
    expect(looksLikeLongRunningServer("nodemon server.js")).toBe(true);
    expect(looksLikeLongRunningServer("tsc --watch")).toBe(true);
  });

  it("does not flag one-shot build/test commands", () => {
    expect(looksLikeLongRunningServer("npm run build")).toBe(false);
    expect(looksLikeLongRunningServer("npm test")).toBe(false);
    expect(looksLikeLongRunningServer("npm run typecheck")).toBe(false);
    expect(looksLikeLongRunningServer("vite build")).toBe(false);
    expect(looksLikeLongRunningServer("node scripts/seed.js")).toBe(false);
    expect(looksLikeLongRunningServer("git status")).toBe(false);
  });
});

describe("run_command refuses long-running servers", () => {
  const ctx = {
    workspace: process.cwd(),
    permissions: new PermissionEngine({
      mode: "bypass" as const,
      policy: { workspace: process.cwd(), allow: ["**/*"], deny: [] },
      allowedCommands: [],
    }),
  };

  it("refuses a detached server before running it", async () => {
    const res = await runCommandTool.run({ command: "start /B node dist/index.js" }, ctx);
    expect(res.ok).toBe(false);
    expect(res.output).toMatch(/long-running server|Refused/i);
  });

  it("still runs a normal one-shot command", async () => {
    const res = await runCommandTool.run({ command: "node -e \"console.log('ok')\"" }, ctx);
    expect(res.ok).toBe(true);
    expect(res.output).toContain("ok");
  });
});
