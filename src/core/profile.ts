import { mkdir, cp, readdir, rm, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, isAbsolute } from 'node:path';
import { existsSync } from 'node:fs';
import { PROFILE_NAME_REGEX, type ProfileConfig, type ProfileInfo, type ClaudeSettings } from '../types.js';
import { loadState, saveState, getProfilesBaseDir, getClaudeDir } from './state.js';

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
  // profileName is validated by PROFILE_NAME_REGEX (alphanumeric + hyphens/underscores only)
  // existingCommand comes from the source settings.json — sanitize shell metacharacters
  if (existingCommand) {
    // Only preserve the existing command if it looks safe (no backticks, $(), etc.)
    const isSafe = !/[`$]/.test(existingCommand);
    if (isSafe) {
      return {
        type: 'command',
        command: `echo -n "${profileName} | " && ${existingCommand}`,
      };
    }
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
  const sourceDir = options.fromDir ? resolve(options.fromDir) : getClaudeDir();
  if (options.fromDir && !existsSync(sourceDir)) {
    throw new Error(`Source directory not found: ${sourceDir}`);
  }

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

  // Append profile-awareness note to CLAUDE.md
  const claudeMdPath = join(profileDir, 'CLAUDE.md');
  const profileNote = `\n\n# Active Profile: ${name}\n\nYou are running on the "${name}" Claude Code profile (managed by claude-profiles). This profile has its own settings.json, hooks, MCP servers, and plugins — isolated from other profiles. Use /profiles-list to see all profiles, /profiles-use to switch.\n`;
  if (existsSync(claudeMdPath)) {
    const existing = await readFile(claudeMdPath, 'utf-8');
    if (!existing.includes('Active Profile:')) {
      await writeFile(claudeMdPath, existing + profileNote);
    }
  } else {
    await writeFile(claudeMdPath, `# ${name} Profile\n${profileNote}`);
  }

  // Write profile metadata
  const config: ProfileConfig = { name, description: options.description, createdAt: new Date().toISOString() };
  await writeFile(join(profileDir, '.profile.json'), JSON.stringify(config, null, 2) + '\n');

  // Install /profiles slash commands into the profile
  await installSlashCommands(profileDir);

  // Register in state
  const state = await loadState(baseDir);
  state.profiles[name] = profileDir;
  await saveState(baseDir, state);

  return profileDir;
}

/**
 * Installs /profiles slash commands into a Claude Code config directory.
 * Each subcommand gets its own file for discoverability.
 */
export async function installSlashCommands(configDir: string): Promise<void> {
  const commandsDir = join(configDir, 'commands');
  await mkdir(commandsDir, { recursive: true });

  const commands: Record<string, string> = {
    'profiles.md': `Manage Claude Code profiles — switch between different configurations (settings, hooks, MCP servers, plugins).

Show a brief overview of what claude-profiles does and the available commands:
- /profiles-list — see all profiles
- /profiles-use — switch profile
- /profiles-create — create a new profile
- /profiles-current — show active profile
- /profiles-delete — delete a profile
- /profiles-toggle — enable/disable plugins

Also mention: the user is currently on the "\${CLAUDE_PROFILES_ACTIVE:-default}" profile. Profiles isolate settings.json, hooks, MCP servers, and CLAUDE.md. The default profile is ~/.claude (untouched).
`,

    'profiles-list.md': `List all Claude Code profiles and show which one is active.

Immediately run: \`claude-profiles list\`
Show the output to the user.
`,

    'profiles-use.md': `Switch to a different Claude Code profile. Changes settings, hooks, MCP servers, and plugins.

If the user provided a name after the command, run: \`claude-profiles use <name>\`
Otherwise ask which profile to switch to (run \`claude-profiles list\` first to show options).
Remind them to restart Claude Code after switching.
`,

    'profiles-create.md': `Create a new Claude Code profile by cloning the current ~/.claude config.

If the user provided details, run: \`claude-profiles create <name> -d "<description>"\`
Otherwise ask for a name and optional description.
`,

    'profiles-current.md': `Show which Claude Code profile is currently active.

Immediately run: \`claude-profiles current\`
Show the result to the user.
`,

    'profiles-delete.md': `Delete a Claude Code profile permanently. Cannot delete the active or default profile.

If the user provided a name, run: \`claude-profiles delete <name> --force\`
Otherwise run \`claude-profiles list\` first to show options, then ask which to delete.
`,

    'profiles-toggle.md': `Enable or disable a plugin in the active Claude Code profile.

First show available plugins by reading the active profile's settings.json:
Run: \`cat $(claude-profiles current | xargs -I{} echo ~/.claude-profiles/profiles/{}/settings.json 2>/dev/null || echo ~/.claude/settings.json) | grep -A50 enabledPlugins\`
Then ask the user which plugin to toggle on or off.
Run: \`claude-profiles toggle plugin <name> on|off\`
`,
  };

  for (const [filename, content] of Object.entries(commands)) {
    const destPath = join(commandsDir, filename);
    // Don't overwrite if already installed
    if (!existsSync(destPath)) {
      await writeFile(destPath, content);
    }
  }
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
  await saveState(baseDir, state);
}
