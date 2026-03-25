import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getClaudeDir } from './state.js';
import type { ClaudeSettings } from '../types.js';

/**
 * Toggle a plugin in the ACTIVE profile's settings.json.
 * Since the active profile's files are always in ~/.claude, we read/write there directly.
 */
export async function togglePlugin(pluginId: string, enabled: boolean): Promise<void> {
  const claudeDir = getClaudeDir();
  const settingsPath = join(claudeDir, 'settings.json');
  let settings: ClaudeSettings = {};
  try { settings = JSON.parse(await readFile(settingsPath, 'utf-8')); } catch {}
  settings.enabledPlugins = settings.enabledPlugins ?? {};
  settings.enabledPlugins[pluginId] = enabled;
  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}

export async function getPluginToggles(): Promise<Record<string, boolean>> {
  const claudeDir = getClaudeDir();
  const settingsPath = join(claudeDir, 'settings.json');
  let settings: ClaudeSettings = {};
  try { settings = JSON.parse(await readFile(settingsPath, 'utf-8')); } catch {}
  return settings.enabledPlugins ?? {};
}
