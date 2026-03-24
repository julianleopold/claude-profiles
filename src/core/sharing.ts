import { cp, mkdir, symlink, rm } from 'node:fs/promises';
import { existsSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import type { SharedResource } from '../types.js';

export function isSymlink(path: string): boolean {
  try { return lstatSync(path).isSymbolicLink(); } catch { return false; }
}

export async function setupSharedResources(
  baseDir: string, profileDir: string, sourceDir: string, resources: SharedResource[],
): Promise<void> {
  const sharedBase = join(baseDir, 'shared');
  await mkdir(sharedBase, { recursive: true });

  for (const resource of resources) {
    const sharedPath = join(sharedBase, resource);
    const profilePath = join(profileDir, resource);
    const sourcePath = join(sourceDir, resource);

    if (!existsSync(sharedPath)) {
      existsSync(sourcePath)
        ? await cp(sourcePath, sharedPath, { recursive: true })
        : await mkdir(sharedPath, { recursive: true });
    }

    if (existsSync(profilePath) && !isSymlink(profilePath)) {
      await rm(profilePath, { recursive: true, force: true });
    }
    if (!existsSync(profilePath)) {
      await symlink(sharedPath, profilePath);
    }
  }
}
