import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { configDir } from "./store.js";

const RECENT_PROJECTS_PATH = join(configDir(), "recent-projects.json");
const MAX_RECENT_PROJECTS = 20;

export interface RecentProject {
  path: string;
  lastOpenedAt: string;
}

async function loadRecentProjects(): Promise<RecentProject[]> {
  if (!existsSync(RECENT_PROJECTS_PATH)) return [];
  try {
    const data = await readFile(RECENT_PROJECTS_PATH, "utf8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveRecentProjects(projects: RecentProject[]): Promise<void> {
  await writeFile(
    RECENT_PROJECTS_PATH,
    JSON.stringify(projects, null, 2) + "\n",
    "utf8",
  );
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