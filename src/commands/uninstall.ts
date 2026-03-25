import { Command } from 'commander';
import * as p from '@clack/prompts';
import { rm, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import { getProfilesBaseDir, getClaudeDir, loadState } from '../core/state.js';
import { restoreConfigFiles } from '../core/profile.js';
import { uninstallHooks } from '../hooks/install.js';
import { getSavedDir } from '../core/state.js';

const SENTINEL_START = '# >>> claude-profiles >>>';
const SENTINEL_END = '# <<< claude-profiles <<<';

async function removeShellIntegration(): Promise<string[]> {
  const home = homedir();
  const shellFiles = ['.zshrc', '.bashrc', '.bash_profile', '.config/fish/config.fish']
    .map((f) => join(home, f))
    .filter((f) => existsSync(f));
  const cleaned: string[] = [];

  for (const file of shellFiles) {
    const content = await readFile(file, 'utf-8');
    if (content.includes(SENTINEL_START)) {
      const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\n?${escaped(SENTINEL_START)}[\\s\\S]*?${escaped(SENTINEL_END)}\\n?`, 'g');
      await writeFile(file, content.replace(regex, '\n'));
      cleaned.push(basename(file));
    }
  }
  return cleaned;
}

export const uninstallCommand = new Command('uninstall')
  .description('Remove claude-profiles and restore your Claude Code config')
  .action(async () => {
    p.intro('claude-profiles uninstall');

    const baseDir = getProfilesBaseDir();
    const claudeDir = getClaudeDir();
    const state = await loadState(baseDir);

    // If not on default, offer to choose which profile to restore
    const nonDefault = state.profiles.filter((p) => p !== 'default');
    if (nonDefault.length > 0 && state.activeProfile !== 'default') {
      const choices = state.profiles.map((name) => ({
        value: name,
        label: name === 'default'
          ? 'default — Restore original ~/.claude config'
          : `${name} — Keep this profile's config in ~/.claude`,
      }));

      const keepChoice = await p.select({
        message: 'Which config should remain in ~/.claude after uninstall?',
        options: choices,
      });
      if (p.isCancel(keepChoice)) { p.outro('Cancelled.'); return; }

      if (keepChoice !== state.activeProfile) {
        const savedDir = getSavedDir(baseDir, keepChoice as string);
        if (existsSync(savedDir)) {
          p.log.step(`Restoring "${keepChoice}" config to ~/.claude...`);
          await restoreConfigFiles(savedDir, claudeDir);
          p.log.success('Config restored');
        }
      }
    } else if (state.activeProfile !== 'default') {
      // Restore default
      const savedDefault = getSavedDir(baseDir, 'default');
      if (existsSync(savedDefault)) {
        p.log.step('Restoring default config to ~/.claude...');
        await restoreConfigFiles(savedDefault, claudeDir);
        p.log.success('Default config restored');
      }
    }

    const confirm = await p.confirm({
      message: 'Remove all profiles, hooks, slash commands, and shell integration?',
    });
    if (p.isCancel(confirm) || !confirm) { p.outro('Cancelled.'); return; }

    // Remove hooks from settings.json
    p.log.step('Removing hooks...');
    await uninstallHooks(claudeDir);

    // Remove slash commands
    const commandsDir = join(claudeDir, 'commands');
    const commandFiles = ['profiles.md', 'profiles-list.md', 'profiles-use.md', 'profiles-create.md', 'profiles-current.md', 'profiles-delete.md', 'profiles-configure.md', 'profiles-toggle.md'];
    for (const file of commandFiles) {
      const filePath = join(commandsDir, file);
      if (existsSync(filePath)) await rm(filePath);
    }

    // Remove hook handler
    const hookHandler = join(claudeDir, 'hooks', 'claude-profiles-hook.mjs');
    if (existsSync(hookHandler)) await rm(hookHandler);

    // Remove shell integration
    p.log.step('Removing shell integration...');
    const cleaned = await removeShellIntegration();
    if (cleaned.length > 0) p.log.success(`Removed from: ${cleaned.join(', ')}`);

    // Remove profiles data
    if (existsSync(baseDir)) {
      p.log.step('Removing ~/.claude-profiles...');
      await rm(baseDir, { recursive: true, force: true });
    }

    p.note(
      'Remove the package with your package manager:\n  npm uninstall -g claude-profiles\n  pnpm remove -g claude-profiles\n  bun remove -g claude-profiles',
      'Final step',
    );
    p.outro('Uninstalled. Claude Code works as before.');
  });
