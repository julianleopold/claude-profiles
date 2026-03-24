import { profileExists, getProfileDir } from './profile.js';
import { loadState, saveState } from './state.js';

export async function switchProfile(baseDir: string, name: string): Promise<void> {
  if (!(await profileExists(baseDir, name))) {
    throw new Error(`Profile "${name}" does not exist`);
  }
  const state = await loadState(baseDir);
  state.activeProfile = name === 'default' ? null : name;
  await saveState(baseDir, state);
}

export function getShellExport(baseDir: string, profileName: string): string {
  if (profileName === 'default') {
    return 'unset CLAUDE_CONFIG_DIR';
  }
  return `export CLAUDE_CONFIG_DIR="${getProfileDir(baseDir, profileName)}"`;
}
