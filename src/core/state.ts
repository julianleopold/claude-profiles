import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { State } from '../types.js';

export function getProfilesBaseDir(): string {
  return process.env.CLAUDE_PROFILES_HOME ?? join(homedir(), '.claude-profiles');
}

export function getClaudeDir(): string {
  return join(homedir(), '.claude');
}

function defaultState(): State {
  return {
    profiles: { default: getClaudeDir() },
    activeProfile: null,
    version: '0.1.0',
  };
}

export async function loadState(baseDir?: string): Promise<State> {
  const dir = baseDir ?? getProfilesBaseDir();
  try {
    const raw = await readFile(join(dir, 'state.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    // Ensure default always points to ~/.claude
    const state = { ...defaultState(), ...parsed };
    state.profiles.default = getClaudeDir();
    return state;
  } catch {
    return defaultState();
  }
}

export async function saveState(baseDir: string, state: State): Promise<void> {
  await mkdir(baseDir, { recursive: true });
  // Don't persist the default path (it's always ~/.claude)
  const toSave = { ...state, profiles: { ...state.profiles } };
  delete toSave.profiles.default;
  await writeFile(join(baseDir, 'state.json'), JSON.stringify(toSave, null, 2) + '\n');
}
