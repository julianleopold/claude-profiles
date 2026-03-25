import { loadState, saveState, getSavedDir, getClaudeDir } from './state.js';
import { saveConfigFiles, restoreConfigFiles, installProfileTools } from './profile.js';
import { existsSync } from 'node:fs';

/**
 * Switch the active profile by swapping config files in ~/.claude.
 *
 * 1. Save current ~/.claude config files → saved/<currentProfile>/
 * 2. Restore saved/<newProfile>/ config files → ~/.claude/
 * 3. Re-install our slash commands + hooks (so they're always available)
 * 4. Update state.json
 */
export async function switchProfile(baseDir: string, name: string): Promise<void> {
  const state = await loadState(baseDir);

  if (!state.profiles.includes(name)) {
    throw new Error(`Profile "${name}" does not exist`);
  }

  if (state.activeProfile === name) {
    return; // Already on this profile
  }

  const claudeDir = getClaudeDir();

  // 1. Save current config files from ~/.claude to saved/<current>/
  const currentSavedDir = getSavedDir(baseDir, state.activeProfile);
  await saveConfigFiles(claudeDir, currentSavedDir);

  // 2. Restore target profile's config files to ~/.claude
  const targetSavedDir = getSavedDir(baseDir, name);
  if (existsSync(targetSavedDir)) {
    await restoreConfigFiles(targetSavedDir, claudeDir);
  }

  // 3. Re-install our slash commands and hooks
  await installProfileTools(claudeDir);

  // 4. Update state
  state.activeProfile = name;
  await saveState(baseDir, state);
}
