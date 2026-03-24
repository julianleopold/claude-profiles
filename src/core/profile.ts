import { mkdir, cp, readdir, rm, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { PROFILE_NAME_REGEX, type ProfileConfig, type ProfileInfo, type ClaudeSettings } from '../types.js';
import { loadState } from './state.js';

/** Dirs that should NOT be copied from an existing ~/.claude config */
const EXCLUDED_DIRS = new Set([
  'plugins', 'projects', 'sessions', 'file-history',
  'debug', 'shell-snapshots', 'session-env', 'backups',
  'todos', 'tasks', 'statslog',
]);

/** Files that should NOT be copied */
const EXCLUDED_FILES = new Set([
  'history.jsonl', 'stats-cache.json', '.session-stats.json',
]);

export function validateProfileName(name: string): boolean {
  return PROFILE_NAME_REGEX.test(name);
}

export function getProfileDir(baseDir: string, name: string): string {
  return join(baseDir, 'profiles', name);
}

export async function profileExists(baseDir: string, name: string): Promise<boolean> {
  return existsSync(getProfileDir(baseDir, name));
}

function makeStatusLine(profileName: string, existingCommand?: string): { type: string; command: string } {
  if (existingCommand) {
    return {
      type: 'command',
      command: `echo -n "${profileName} | " && ${existingCommand}`,
    };
  }
  return {
    type: 'command',
    command: `echo "${profileName} |"`,
  };
}

export async function createProfile(
  baseDir: string,
  name: string,
  options: { description?: string; fromDir?: string } = {},
): Promise<string> {
  if (!validateProfileName(name)) {
    throw new Error(
      `Invalid profile name "${name}". Use lowercase alphanumeric, hyphens, underscores. Must start with a letter or number.`,
    );
  }
  if (await profileExists(baseDir, name)) {
    throw new Error(`Profile "${name}" already exists`);
  }

  const profileDir = getProfileDir(baseDir, name);
  await mkdir(profileDir, { recursive: true });

  let existingStatusLineCommand: string | undefined;

  if (options.fromDir) {
    const entries = await readdir(options.fromDir, { withFileTypes: true });
    for (const entry of entries) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      if (EXCLUDED_FILES.has(entry.name)) continue;
      await cp(join(options.fromDir, entry.name), join(profileDir, entry.name), { recursive: true });
    }
    try {
      const existing: ClaudeSettings = JSON.parse(
        await readFile(join(profileDir, 'settings.json'), 'utf-8'),
      );
      existingStatusLineCommand = existing.statusLine?.command;
    } catch {}
  } else {
    await writeFile(join(profileDir, 'settings.json'), '{}\n');
    await writeFile(
      join(profileDir, 'CLAUDE.md'),
      `# ${name} Profile\n\nClaude Code instructions for the "${name}" profile.\n`,
    );
  }

  const settingsPath = join(profileDir, 'settings.json');
  let settings: ClaudeSettings = {};
  try { settings = JSON.parse(await readFile(settingsPath, 'utf-8')); } catch {}
  settings.statusLine = makeStatusLine(name, existingStatusLineCommand);
  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n');

  const config: ProfileConfig = { name, description: options.description, createdAt: new Date().toISOString() };
  await writeFile(join(profileDir, '.profile.json'), JSON.stringify(config, null, 2) + '\n');

  return profileDir;
}

export async function listProfiles(baseDir: string): Promise<ProfileInfo[]> {
  const profilesDir = join(baseDir, 'profiles');
  if (!existsSync(profilesDir)) return [];

  const state = await loadState(baseDir);
  const envConfigDir = process.env.CLAUDE_CONFIG_DIR;

  const entries = await readdir(profilesDir, { withFileTypes: true });
  const profiles: ProfileInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const profileDir = join(profilesDir, entry.name);
    let config: ProfileConfig = { name: entry.name, createdAt: 'unknown' };
    try { config = JSON.parse(await readFile(join(profileDir, '.profile.json'), 'utf-8')); } catch {}

    const isActiveByEnv = envConfigDir ? envConfigDir === profileDir : false;
    const isActiveByState = !envConfigDir && state.activeProfile === entry.name;

    profiles.push({
      name: entry.name,
      path: profileDir,
      config,
      isActive: isActiveByEnv || isActiveByState,
      isDefault: entry.name === state.defaultProfile,
    });
  }

  return profiles.sort((a, b) => a.name.localeCompare(b.name));
}

export async function deleteProfile(baseDir: string, name: string): Promise<void> {
  if (!(await profileExists(baseDir, name))) {
    throw new Error(`Profile "${name}" does not exist`);
  }
  const state = await loadState(baseDir);
  const envConfigDir = process.env.CLAUDE_CONFIG_DIR;
  const profileDir = getProfileDir(baseDir, name);
  const isActive = envConfigDir ? envConfigDir === profileDir : state.activeProfile === name;
  if (isActive) {
    throw new Error(`Cannot delete "${name}" — it is currently active. Switch first.`);
  }
  await rm(profileDir, { recursive: true, force: true });
}
