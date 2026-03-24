import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getProfileDir } from './profile.js';
import type { ClaudeSettings } from '../types.js';

async function readSettings(profileDir: string): Promise<ClaudeSettings> {
  try { return JSON.parse(await readFile(join(profileDir, 'settings.json'), 'utf-8')); }
  catch { return {}; }
}

async function writeSettings(profileDir: string, settings: ClaudeSettings): Promise<void> {
  await writeFile(join(profileDir, 'settings.json'), JSON.stringify(settings, null, 2) + '\n');
}

export async function togglePlugin(
  baseDir: string, profileName: string, pluginId: string, enabled: boolean,
): Promise<void> {
  const profileDir = getProfileDir(baseDir, profileName);
  const settings = await readSettings(profileDir);
  settings.enabledPlugins = settings.enabledPlugins ?? {};
  settings.enabledPlugins[pluginId] = enabled;
  await writeSettings(profileDir, settings);
}

export async function getPluginToggles(
  baseDir: string, profileName: string,
): Promise<Record<string, boolean>> {
  const profileDir = getProfileDir(baseDir, profileName);
  const settings = await readSettings(profileDir);
  return settings.enabledPlugins ?? {};
}
