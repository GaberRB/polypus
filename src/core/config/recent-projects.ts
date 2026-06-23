import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { configDir } from "./store.js";

const MAX_RECENT_PROJECTS = 20;

// Resolved lazily so it honours POLYPUS_HOME at call time (and stays testable).
function recentProjectsPath(): string {
  return join(configDir(), "recent-projects.json");
}

export interface RecentProject {
  path: string;
  lastOpenedAt: string;
}

async function loadRecentProjects(): Promise<RecentProject[]> {
  const file = recentProjectsPath();
  if (!existsSync(file)) return [];
  try {
    const data = await readFile(file, "utf8");
    return JSON.parse(data) as RecentProject[];
  } catch {
    return [];
  }
}

async function saveRecentProjects(projects: RecentProject[]): Promise<void> {
  await writeFile(recentProjectsPath(), JSON.stringify(projects, null, 2) + "\n", "utf8");
}

export async function addRecentProject(path: string): Promise<void> {
  const projects = await loadRecentProjects();
  const updated = [
    { path, lastOpenedAt: new Date().toISOString() },
    ...projects.filter((p) => p.path !== path),
  ].slice(0, MAX_RECENT_PROJECTS);
  await saveRecentProjects(updated);
}

export async function listRecentProjects(): Promise<RecentProject[]> {
  return loadRecentProjects();
}

export async function removeRecentProject(path: string): Promise<void> {
  const projects = await loadRecentProjects();
  await saveRecentProjects(projects.filter((p) => p.path !== path));
}