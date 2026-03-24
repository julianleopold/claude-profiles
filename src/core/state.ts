import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { State } from '../types.js';

const DEFAULT_STATE: State = {
  defaultProfile: 'default',
  activeProfile: null,
  sharedResources: ['plugins', 'projects'],
  version: '0.1.0',
};

export function getProfilesBaseDir(): string {
  return process.env.CLAUDE_PROFILES_HOME ?? join(homedir(), '.claude-profiles');
}

export async function loadState(baseDir?: string): Promise<State> {
  const dir = baseDir ?? getProfilesBaseDir();
  try {
    const raw = await readFile(join(dir, 'state.json'), 'utf-8');
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export async function saveState(baseDir: string, state: State): Promise<void> {
  await mkdir(baseDir, { recursive: true });
  await writeFile(join(baseDir, 'state.json'), JSON.stringify(state, null, 2) + '\n');
}
