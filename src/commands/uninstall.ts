import { Command } from 'commander';
import * as p from '@clack/prompts';
import { cp, rm, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import { getProfilesBaseDir, getClaudeDir } from '../core/state.js';
import { uninstallHooks } from '../hooks/install.js';

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
    const profilesDir = join(baseDir, 'profiles');

    // Find non-default profiles
    const nonDefaultProfiles: string[] = [];
    if (existsSync(profilesDir)) {
      const entries = await readdir(profilesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) nonDefaultProfiles.push(entry.name);
      }
    }

    // If there are non-default profiles, ask which config to keep as ~/.claude
    if (nonDefaultProfiles.length > 0) {
      const choices = [
        { value: 'default', label: 'default — Keep ~/.claude as-is (no changes)' },
        ...nonDefaultProfiles.map((name) => ({
          value: name,
          label: `${name} — Copy this profile's config into ~/.claude`,
        })),
      ];

      const keepChoice = await p.select({
        message: 'Which config should remain as your ~/.claude after uninstall?',
        options: choices,
      });
      if (p.isCancel(keepChoice)) { p.outro('Cancelled.'); return; }

      if (keepChoice !== 'default') {
        const confirm = await p.confirm({
          message: `This will REPLACE ~/.claude with the "${keepChoice}" profile's config. Continue?`,
        });
        if (p.isCancel(confirm) || !confirm) { p.outro('Cancelled.'); return; }

        const sourceDir = join(profilesDir, keepChoice as string);
        p.log.step(`Copying "${keepChoice}" profile config into ~/.claude...`);

        // Copy profile settings into ~/.claude (only config files, not ephemeral dirs)
        const configFiles = ['settings.json', 'settings.local.json', 'mcp.json', 'CLAUDE.md'];
        for (const file of configFiles) {
          const src = join(sourceDir, file);
          const dest = join(claudeDir, file);
          if (existsSync(src)) {
            await cp(src, dest, { force: true });
          }
        }
        // Copy commands dir if it exists
        const commandsSrc = join(sourceDir, 'commands');
        if (existsSync(commandsSrc)) {
          await cp(commandsSrc, join(claudeDir, 'commands'), { recursive: true, force: true });
        }
        p.log.success(`~/.claude updated with "${keepChoice}" config`);
      }
    }

    const confirm = await p.confirm({
      message: 'Remove all profiles and shell integration?',
    });
    if (p.isCancel(confirm) || !confirm) { p.outro('Cancelled.'); return; }

    // Remove hooks from settings.json
    p.log.step('Removing hooks from settings.json...');
    await uninstallHooks(claudeDir);

    // Remove slash command files
    p.log.step('Removing slash commands...');
    const commandsDir = join(claudeDir, 'commands');
    const commandFiles = ['profiles.md', 'profiles-list.md', 'profiles-use.md', 'profiles-create.md', 'profiles-current.md', 'profiles-delete.md', 'profiles-toggle.md'];
    for (const file of commandFiles) {
      const filePath = join(commandsDir, file);
      if (existsSync(filePath)) await rm(filePath);
    }

    // Remove hook handler script
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
    p.outro('Uninstalled. Your ~/.claude is untouched — Claude Code works as before.');
  });
