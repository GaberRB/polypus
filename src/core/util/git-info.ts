import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GitInfo {
  isRepo: boolean;
  root?: string;
  branch?: string;
}

export async function gitInfo(dir: string): Promise<GitInfo> {
  try {
    const [{ stdout: isRepo }, { stdout: root }, { stdout: branch }] = await Promise.all([
      execAsync('git rev-parse --is-inside-work-tree', { cwd: dir }),
      execAsync('git rev-parse --show-toplevel', { cwd: dir }),
      execAsync('git rev-parse --abbrev-ref HEAD', { cwd: dir }),
    ]);

    return {
      isRepo: isRepo.trim() === 'true',
      root: root.trim(),
      branch: branch.trim(),
    };
  } catch {
    return { isRepo: false };
  }
}
