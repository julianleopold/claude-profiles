import { mkdir, cp, rm, rename, readFile, writeFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { PROFILE_NAME_REGEX, CONFIG_FILES, CONFIG_DIRS, type ProfileConfig, type ProfileInfo, type ClaudeSettings } from '../types.js';
import { loadState, saveState, getSavedDir, getClaudeDir, getProfilesBaseDir } from './state.js';

export function validateProfileName(name: string): boolean {
  return PROFILE_NAME_REGEX.test(name);
}

function makeStatusLine(profileName: string, existingCommand?: string): { type: string; command: string } {
  if (profileName === 'default') {
    // Don't add prefix for default — keep statusline as-is
    return existingCommand
      ? { type: 'command', command: existingCommand }
      : { type: 'command', command: 'echo ""' };
  }
  if (existingCommand) {
    const isSafe = !/[`$]/.test(existingCommand);
    if (isSafe) {
      return { type: 'command', command: `printf "%s" "${profileName} | " && ${existingCommand}` };
    }
  }
  return { type: 'command', command: `printf "%s" "${profileName} |"` };
}

/**
 * Create a one-time safety backup of ~/.claude config files.
 * This backup is NEVER deleted — even on uninstall.
 * Stored outside ~/.claude-profiles so uninstall can't destroy it.
 */
export async function createSafetyBackup(claudeDir: string): Promise<void> {
  const backupDir = join(claudeDir, '.profiles-backup');
  if (existsSync(backupDir)) return; // Already exists, never overwrite
  await saveConfigFiles(claudeDir, backupDir);
}

/**
 * Save config files from a source directory to a saved profile directory.
 */
export async function saveConfigFiles(sourceDir: string, savedDir: string): Promise<void> {
  await mkdir(savedDir, { recursive: true });

  for (const file of CONFIG_FILES) {
    const src = join(sourceDir, file);
    if (existsSync(src)) {
      await cp(src, join(savedDir, file), { force: true });
    }
  }

  for (const dir of CONFIG_DIRS) {
    const src = join(sourceDir, dir);
    const dest = join(savedDir, dir);
    if (existsSync(src)) {
      if (existsSync(dest)) await rm(dest, { recursive: true, force: true });
      await cp(src, dest, { recursive: true });
    }
  }
}

/**
 * Restore config files from a saved profile directory to a target directory.
 * Uses temp-then-rename for directories to avoid data loss if cp fails mid-way.
 */
export async function restoreConfigFiles(savedDir: string, targetDir: string): Promise<void> {
  for (const file of CONFIG_FILES) {
    const src = join(savedDir, file);
    const dest = join(targetDir, file);
    if (existsSync(src)) {
      await cp(src, dest, { force: true });
    }
  }

  for (const dir of CONFIG_DIRS) {
    const src = join(savedDir, dir);
    const dest = join(targetDir, dir);
    if (existsSync(src)) {
      // Copy to temp dir first, then swap atomically
      const tempDest = dest + '.new';
      if (existsSync(tempDest)) await rm(tempDest, { recursive: true, force: true });
      await cp(src, tempDest, { recursive: true });
      // Now swap: remove old, rename new
      if (existsSync(dest)) await rm(dest, { recursive: true, force: true });
      await rename(tempDest, dest);
    }
  }
}

/**
 * Create a new profile by saving a copy of the current ~/.claude config files.
 */
export async function createProfile(
  baseDir: string,
  name: string,
  options: { description?: string; fromDir?: string } = {},
): Promise<void> {
  if (!validateProfileName(name)) {
    throw new Error(
      `Invalid profile name "${name}". Use lowercase alphanumeric, hyphens, underscores. Must start with a letter or number.`,
    );
  }

  const state = await loadState(baseDir);
  if (state.profiles.includes(name)) {
    throw new Error(`Profile "${name}" already exists`);
  }

  const sourceDir = options.fromDir ? resolve(options.fromDir) : getClaudeDir();
  if (!existsSync(sourceDir)) {
    throw new Error(`Source directory not found: ${sourceDir}`);
  }

  // Create safety backup on first profile creation (never deleted, even on uninstall)
  await createSafetyBackup(getClaudeDir());

  const savedDir = getSavedDir(baseDir, name);

  // Save config files from source to the new profile's saved dir
  await saveConfigFiles(sourceDir, savedDir);

  // Inject statusline into the saved profile's settings.json
  const settingsPath = join(savedDir, 'settings.json');
  let settings: ClaudeSettings = {};
  try { settings = JSON.parse(await readFile(settingsPath, 'utf-8')); } catch {}
  const existingStatusLine = settings.statusLine?.command;
  settings.statusLine = makeStatusLine(name, existingStatusLine);
  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n');

  // Add profile-awareness note to CLAUDE.md
  const claudeMdPath = join(savedDir, 'CLAUDE.md');
  const profileNote = `\n\n# Active Profile: ${name}\n\nYou are running on the "${name}" Claude Code profile (managed by claude-profiles). This profile has its own settings, hooks, MCP servers, and plugins — isolated from other profiles. Use /profiles-list to see all profiles, /profiles-use to switch.\n`;
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
  await writeFile(join(savedDir, '.profile.json'), JSON.stringify(config, null, 2) + '\n');

  // Register in state
  state.profiles.push(name);
  await saveState(baseDir, state);
}

export async function listProfiles(baseDir: string): Promise<ProfileInfo[]> {
  const state = await loadState(baseDir);
  const profiles: ProfileInfo[] = [];

  for (const name of state.profiles) {
    let config: ProfileConfig = { name, createdAt: name === 'default' ? 'built-in' : 'unknown' };

    // Try to read metadata from saved dir
    const savedDir = getSavedDir(baseDir, name);
    const metaPath = join(savedDir, '.profile.json');
    if (existsSync(metaPath)) {
      try { config = JSON.parse(await readFile(metaPath, 'utf-8')); } catch {}
    }
    if (name === 'default') {
      config.description = config.description ?? 'Your ~/.claude config';
    }

    profiles.push({
      name,
      config,
      isActive: state.activeProfile === name,
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
    throw new Error('Cannot delete the default profile.');
  }

  const state = await loadState(baseDir);
  if (!state.profiles.includes(name)) {
    throw new Error(`Profile "${name}" does not exist`);
  }
  if (state.activeProfile === name) {
    throw new Error(`Cannot delete "${name}" — it is currently active. Switch to another profile first.`);
  }

  // Remove saved files
  const savedDir = getSavedDir(baseDir, name);
  if (existsSync(savedDir)) {
    await rm(savedDir, { recursive: true, force: true });
  }

  // Remove from state
  state.profiles = state.profiles.filter((p) => p !== name);
  await saveState(baseDir, state);
}

/**
 * Install our slash commands and hooks into a config directory.
 * Called after switching to ensure our tools are always available.
 */
export async function installProfileTools(configDir: string): Promise<void> {
  // Install slash commands
  await installSlashCommands(configDir);
  // Install hooks
  const { installHooks } = await import('../hooks/install.js');
  await installHooks(configDir);
}

/**
 * Installs /profiles slash commands into a Claude Code config directory.
 */
export async function installSlashCommands(configDir: string): Promise<void> {
  const commandsDir = join(configDir, 'commands');
  await mkdir(commandsDir, { recursive: true });

  const commands: Record<string, string> = {
    'profiles.md': `Manage Claude Code profiles — switch between different configurations (settings, hooks, MCP servers, plugins). Immediately run \`claude-profiles list\` and show the output. Then briefly mention: /profiles-create, /profiles-use, /profiles-configure are available.
`,

    'profiles-list.md': `List all Claude Code profiles and show which one is active. Immediately run: \`claude-profiles list\`
`,

    'profiles-use.md': `Switch to a different Claude Code profile. Changes settings, hooks, MCP servers, and plugins. If the user provided a name, run: \`claude-profiles use <name>\`. Otherwise run \`claude-profiles list\` first, then ask which to switch to. After switching, tell the user to restart Claude Code.
`,

    'profiles-create.md': `Create a new Claude Code profile by cloning ~/.claude. If the user provided a name, run: \`claude-profiles create <name>\` (add \`-d "desc"\` only if they gave a description). Otherwise just ask for a name. Description is optional. After creation, ask: "Do you want to switch to this profile now? (y/n)" — if yes, run \`claude-profiles use <name>\`.
`,

    'profiles-current.md': `Show which Claude Code profile is currently active. Immediately run: \`claude-profiles current\`
`,

    'profiles-delete.md': `Delete a Claude Code profile. Cannot delete the active or default profile. If the user provided a name, run: \`claude-profiles delete <name> --force\`. Otherwise run \`claude-profiles list\` first, then ask which to delete.
`,

    'profiles-configure.md': `Configure plugins in the active Claude Code profile. First run \`claude-profiles current\` to show the active profile. Then read the profile's settings.json to show enabledPlugins. Ask the user what to change. To toggle a plugin, run: \`claude-profiles toggle plugin <name> on|off\`
`,
  };

  for (const [filename, content] of Object.entries(commands)) {
    const destPath = join(commandsDir, filename);
    if (!existsSync(destPath)) {
      await writeFile(destPath, content);
    }
  }
}
