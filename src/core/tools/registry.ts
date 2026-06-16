import type { ToolSpec } from "../providers/types.js";
import { editFileTool } from "./edit-file.js";
import { listDirTool } from "./list-dir.js";
import { readFileTool } from "./read-file.js";
import { runCommandTool } from "./run-command.js";
import { FINISH_TOOL, type Tool } from "./types.js";
import { writeFileTool } from "./write-file.js";

/** All executable tools, keyed by name. `finish` is intercepted by the loop, not run here. */
export const TOOLS: Record<string, Tool> = {
  [readFileTool.spec.name]: readFileTool,
  [listDirTool.spec.name]: listDirTool,
  [writeFileTool.spec.name]: writeFileTool,
  [editFileTool.spec.name]: editFileTool,
  [runCommandTool.spec.name]: runCommandTool,
};

/** Tool specs advertised to the model, including the `finish` sentinel. */
export function toolSpecs(): ToolSpec[] {
  return [...Object.values(TOOLS).map((t) => t.spec), FINISH_TOOL];
}

export function getTool(name: string): Tool | undefined {
  return TOOLS[name];
}
