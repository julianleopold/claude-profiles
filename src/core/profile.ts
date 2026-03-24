import { mkdir, cp, readdir, rm, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PROFILE_NAME_REGEX, type ProfileConfig, type ProfileInfo, type ClaudeSettings } from '../types.js';
import { loadState, getProfilesBaseDir, getClaudeDir } from './state.js';

/** Dirs to skip when cloning from ~/.claude (ephemeral/large) */
const EXCLUDED_DIRS = new Set([
  'plugins', 'projects', 'sessions', 'file-history',
  'debug', 'shell-snapshots', 'session-env', 'backups',
  'todos', 'tasks', 'statslog', 'cache', 'ide',
  'paste-cache', 'telemetry',
]);

const EXCLUDED_FILES = new Set([
  'history.jsonl', 'stats-cache.json', '.session-stats.json',
]);

export function validateProfileName(name: string): boolean {
  return PROFILE_NAME_REGEX.test(name);
}

export function getProfileDir(baseDir: string, name: string): string {
  if (name === 'default') return getClaudeDir();
  return join(baseDir, 'profiles', name);
}

export async function profileExists(baseDir: string, name: string): Promise<boolean> {
  if (name === 'default') return true; // default always exists (it's ~/.claude)
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
  if (name === 'default') {
    throw new Error('"default" is reserved — it always points to ~/.claude');
  }
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

  // Default: clone from ~/.claude (the default profile)
  const sourceDir = options.fromDir ?? getClaudeDir();

  if (existsSync(sourceDir)) {
    const entries = await readdir(sourceDir, { withFileTypes: true });
    for (const entry of entries) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      if (EXCLUDED_FILES.has(entry.name)) continue;
      await cp(join(sourceDir, entry.name), join(profileDir, entry.name), { recursive: true });
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

  // Inject statusline
  const settingsPath = join(profileDir, 'settings.json');
  let settings: ClaudeSettings = {};
  try { settings = JSON.parse(await readFile(settingsPath, 'utf-8')); } catch {}
  settings.statusLine = makeStatusLine(name, existingStatusLineCommand);
  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n');

  // Write profile metadata
  const config: ProfileConfig = { name, description: options.description, createdAt: new Date().toISOString() };
  await writeFile(join(profileDir, '.profile.json'), JSON.stringify(config, null, 2) + '\n');

  // Install /profiles slash command into the profile
  await installSlashCommand(profileDir);

  // Register in state
  const state = await loadState(baseDir);
  state.profiles[name] = profileDir;
  const { saveState } = await import('./state.js');
  await saveState(baseDir, state);

  return profileDir;
}

/**
 * Copies the /profiles slash command into a Claude Code config directory.
 * Works for both ~/.claude (default) and profile dirs.
 */
export async function installSlashCommand(configDir: string): Promise<void> {
  const commandsDir = join(configDir, 'commands');
  await mkdir(commandsDir, { recursive: true });
  const destPath = join(commandsDir, 'profiles.md');

  // Don't overwrite if already installed
  if (existsSync(destPath)) return;

  // The command file content (inlined to avoid path resolution issues with npm global installs)
  const content = `# /profiles — Manage Claude Code Profiles

Run profile management from within Claude Code by executing the corresponding CLI command.

## Commands

| Action | Command |
|--------|---------|
| List all profiles | \`claude-profiles list\` |
| Switch profile | \`claude-profiles use <name>\` |
| Show active profile | \`claude-profiles current\` |
| Create a profile | \`claude-profiles create <name>\` |
| Delete a profile | \`claude-profiles delete <name>\` |
| Toggle a plugin | \`claude-profiles toggle plugin <name> on\\|off\` |

## Notes

- After switching profiles, **restart Claude Code** for changes to take effect
- The active profile shows in the statusline: \`default | Opus 4.6 (1M context) | ...\`
- Use \`.claude-profile\` files in project roots for automatic per-directory switching
- To edit a profile's config directly: open \`~/.claude-profiles/profiles/<name>/settings.json\`
- To edit MCP servers: open \`~/.claude-profiles/profiles/<name>/mcp.json\`
`;
  await writeFile(destPath, content);
}

export async function listProfiles(baseDir: string): Promise<ProfileInfo[]> {
  const state = await loadState(baseDir);
  const envConfigDir = process.env.CLAUDE_CONFIG_DIR;
  const profiles: ProfileInfo[] = [];

  for (const [name, path] of Object.entries(state.profiles)) {
    if (!existsSync(path)) continue;

    let config: ProfileConfig = { name, createdAt: name === 'default' ? 'built-in' : 'unknown' };
    const metaPath = join(path, '.profile.json');
    if (existsSync(metaPath)) {
      try { config = JSON.parse(await readFile(metaPath, 'utf-8')); } catch {}
    }
    if (name === 'default') {
      config.description = config.description ?? 'Your ~/.claude config';
    }

    // Active = CLAUDE_CONFIG_DIR points to this profile, OR it's default and no CLAUDE_CONFIG_DIR is set
    const isActiveByEnv = envConfigDir ? envConfigDir === path : false;
    const isActiveByState = !envConfigDir && state.activeProfile === name;
    const isDefaultActive = !envConfigDir && !state.activeProfile && name === 'default';

    profiles.push({
      name,
      path,
      config,
      isActive: isActiveByEnv || isActiveByState || isDefaultActive,
      isDefault: name === 'default',
    });
  }

  return profiles.sort((a, b) => {
    if (a.name === 'default') return -1;
    if (b.name === 'default') return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function deleteProfile(baseDir: string, name: string): Promise<void> {
  if (name === 'default') {
    throw new Error('Cannot delete the default profile — it is your ~/.claude config.');
  }
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

  // Remove from state
  delete state.profiles[name];
  const { saveState } = await import('./state.js');
  await saveState(baseDir, state);
}
