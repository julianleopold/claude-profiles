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
    'profiles.md': `# /profiles — Manage Claude Code Profiles

Overview of available profile commands. Use the specific subcommands below.

Run \`claude-profiles list\` to see all profiles, or type \`/profiles-\` to see all available commands.

## Notes
- After switching profiles, **restart Claude Code** for changes to take effect
- Non-default profiles show their name in the statusline: \`ruflo | Opus 4.6 ...\`
- Use \`.claude-profile\` files in project roots for automatic per-directory switching
- To edit a profile's config directly: open \`~/.claude-profiles/profiles/<name>/settings.json\`
- To edit MCP servers: open \`~/.claude-profiles/profiles/<name>/mcp.json\`
`,

    'profiles-list.md': `# /profiles-list — List all Claude Code profiles

Run this command to see all available profiles and which one is active.

\`\`\`bash
claude-profiles list
\`\`\`

Output shows \`*\` next to the active profile and \`[default]\` for the default.
`,

    'profiles-use.md': `# /profiles-use — Switch to a different profile

Switch the active Claude Code profile. Requires a profile name as argument.

\`\`\`bash
claude-profiles use <name>
\`\`\`

Example: \`claude-profiles use ruflo\`

After switching, **restart Claude Code** for changes to take effect. The shell hook will pick up the change in new terminals automatically.

To switch back to your default ~/.claude config: \`claude-profiles use default\`
`,

    'profiles-create.md': `# /profiles-create — Create a new profile

Create a new profile by cloning your current ~/.claude config.

\`\`\`bash
claude-profiles create <name>
claude-profiles create <name> -d "Description"
claude-profiles create <name> --from /path/to/other/config
\`\`\`

Example: \`claude-profiles create ruflo -d "Ruflo orchestration setup"\`

The new profile is a copy of your current config. You can then customize its settings.json, mcp.json, and CLAUDE.md independently.
`,

    'profiles-current.md': `# /profiles-current — Show the active profile

Display which profile is currently active.

\`\`\`bash
claude-profiles current
\`\`\`

Returns the profile name (e.g., "default", "ruflo").
`,

    'profiles-delete.md': `# /profiles-delete — Delete a profile

Delete a profile permanently. Cannot delete the active profile or the default profile.

\`\`\`bash
claude-profiles delete <name>
claude-profiles delete <name> --force   # skip confirmation
\`\`\`

Switch to a different profile first if the one you want to delete is active.
`,

    'profiles-toggle.md': `# /profiles-toggle — Enable or disable a plugin

Toggle a plugin on or off in the currently active profile.

\`\`\`bash
claude-profiles toggle plugin <name> on
claude-profiles toggle plugin <name> off
\`\`\`

Example: \`claude-profiles toggle plugin superpowers@claude-plugins-official off\`

This modifies \`enabledPlugins\` in the active profile's settings.json. Restart Claude Code for changes to take effect.
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
