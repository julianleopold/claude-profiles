import { cp, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function getBackupDir(baseDir: string): string {
  return join(baseDir, '.pre-profiles-backup');
}

export async function backupExists(baseDir: string): Promise<boolean> {
  return existsSync(getBackupDir(baseDir));
}

export async function createBackup(baseDir: string, claudeDir: string): Promise<void> {
  if (await backupExists(baseDir)) return;
  await mkdir(getBackupDir(baseDir), { recursive: true });
  await cp(claudeDir, getBackupDir(baseDir), { recursive: true });
}
