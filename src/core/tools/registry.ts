import type { ToolSpec } from "../providers/types.js";
import { applyPatchTool } from "./apply-patch.js";
import { deleteFileTool } from "./delete-file.js";
import { editFileTool } from "./edit-file.js";
import { fileStatsTool } from "./file-stats.js";
import { findFilesTool } from "./find-files.js";
import { listDirTool } from "./list-dir.js";
import { moveFileTool } from "./move-file.js";
import { readFileTool } from "./read-file.js";
import { retrieveTool } from "./retrieve.js";
import { runCommandTool } from "./run-command.js";
import { runPythonScriptTool } from "./run-python-script.js";
import { searchTool } from "./search-file.js";
import { FINISH_TOOL, type Tool } from "./types.js";
import { writeFileTool } from "./write-file.js";

/** All executable tools, keyed by name. `finish` is intercepted by the loop, not run here. */
export const TOOLS: Record<string, Tool> = {
  [readFileTool.spec.name]: readFileTool,
  [listDirTool.spec.name]: listDirTool,
  [fileStatsTool.spec.name]: fileStatsTool,
  [findFilesTool.spec.name]: findFilesTool,
  [searchTool.spec.name]: searchTool,
  [retrieveTool.spec.name]: retrieveTool,
  [writeFileTool.spec.name]: writeFileTool,
  [editFileTool.spec.name]: editFileTool,
  [applyPatchTool.spec.name]: applyPatchTool,
  [deleteFileTool.spec.name]: deleteFileTool,
  [moveFileTool.spec.name]: moveFileTool,
  [runCommandTool.spec.name]: runCommandTool,
  [runPythonScriptTool.spec.name]: runPythonScriptTool,
};

/** Tool specs advertised to the model, including the `finish` sentinel. */
export function toolSpecs(): ToolSpec[] {
  return [...Object.values(TOOLS).map((t) => t.spec), FINISH_TOOL];
}

export function getTool(name: string): Tool | undefined {
  return TOOLS[name];
}
