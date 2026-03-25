import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { State } from '../types.js';

export function getProfilesBaseDir(): string {
  return process.env.CLAUDE_PROFILES_HOME ?? join(homedir(), '.claude-profiles');
}

export function getClaudeDir(): string {
  return process.env.CLAUDE_PROFILES_CLAUDE_DIR ?? join(homedir(), '.claude');
}

export function getSavedDir(baseDir: string, profileName: string): string {
  return join(baseDir, 'saved', profileName);
}

function defaultState(): State {
  return {
    activeProfile: 'default',
    profiles: ['default'],
    version: '0.1.0',
  };
}

export async function loadState(baseDir?: string): Promise<State> {
  const dir = baseDir ?? getProfilesBaseDir();
  try {
    const raw = await readFile(join(dir, 'state.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    const state = { ...defaultState(), ...parsed };
    // Ensure default is always in profiles list
    if (!state.profiles.includes('default')) {
      state.profiles.unshift('default');
    }
    return state;
  } catch {
    return defaultState();
  }
}

export async function saveState(baseDir: string, state: State): Promise<void> {
  await mkdir(baseDir, { recursive: true });
  await writeFile(join(baseDir, 'state.json'), JSON.stringify(state, null, 2) + '\n');
}
