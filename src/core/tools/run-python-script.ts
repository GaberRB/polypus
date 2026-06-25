import { exec } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import type { Tool } from "./types.js";

const execAsync = promisify(exec);

const Args = z.object({
  script: z.string().min(1).describe("Python script to execute"),
  input: z.string().optional().describe("Input data to pass to the script"),
});

export const runPythonScriptTool: Tool = {
  mutating: false,
  spec: {
    name: "run_python_script",
    description: "Execute a Python script to read structured files (e.g., CSV, JSON, XML, YAML).",
    parameters: {
      type: "object",
      properties: {
        script: { type: "string", description: "Python script to execute" },
        input: { type: "string", description: "Input data to pass to the script" },
      },
      required: ["script"],
    },
  },
  async run(rawArgs, ctx) {
    const args = Args.safeParse(rawArgs);
    if (!args.success) return { ok: false, output: "Invalid args: 'script' is required." };

    try {
      const { stdout, stderr } = await execAsync(`python -c "${args.data.script.replace(/"/g, '\\"')}"`, {
        cwd: ctx.workspace,
      });

      if (stderr) return { ok: false, output: `Python script error: ${stderr}` };
      return { ok: true, output: stdout.trim() };
    } catch (err) {
      return { ok: false, output: `Failed to execute Python script: ${(err as Error).message}` };
    }
  },
};
