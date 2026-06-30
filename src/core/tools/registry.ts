import type { ToolSpec } from "../providers/types.js";
import { applyPatchTool } from "./apply-patch.js";
import { askUserTool } from "./ask-user.js";
import { codeOutlineTool } from "./code-outline.js";
import { deleteFileTool } from "./delete-file.js";
import { downloadTool } from "./download.js";
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
import { updatePlanTool } from "./update-plan.js";
import { webFetchTool } from "./web-fetch.js";
import { webSearchTool } from "./web-search.js";
import { writeFileTool } from "./write-file.js";
import { WEB_TOOLS } from "./web.js";

/** All executable tools, keyed by name. `finish` is intercepted by the loop, not run here. */
export const TOOLS: Record<string, Tool> = {
  [readFileTool.spec.name]: readFileTool,
  [listDirTool.spec.name]: listDirTool,
  [fileStatsTool.spec.name]: fileStatsTool,
  [findFilesTool.spec.name]: findFilesTool,
  [codeOutlineTool.spec.name]: codeOutlineTool,
  [searchTool.spec.name]: searchTool,
  [retrieveTool.spec.name]: retrieveTool,
  [updatePlanTool.spec.name]: updatePlanTool,
  [askUserTool.spec.name]: askUserTool,
  [writeFileTool.spec.name]: writeFileTool,
  [editFileTool.spec.name]: editFileTool,
  [applyPatchTool.spec.name]: applyPatchTool,
  [deleteFileTool.spec.name]: deleteFileTool,
  [moveFileTool.spec.name]: moveFileTool,
  [runCommandTool.spec.name]: runCommandTool,
  [runPythonScriptTool.spec.name]: runPythonScriptTool,
  [webSearchTool.spec.name]: webSearchTool,
  [webFetchTool.spec.name]: webFetchTool,
  [downloadTool.spec.name]: downloadTool,
  ...Object.fromEntries(WEB_TOOLS.map((t) => [t.spec.name, t])),
};

/** Tool specs advertised to the model, including the `finish` sentinel. */
export function toolSpecs(): ToolSpec[] {
  return [...Object.values(TOOLS).map((t) => t.spec), FINISH_TOOL];
}

export function getTool(name: string): Tool | undefined {
  return TOOLS[name];
}
